import { CompiledQuery, DatabaseConnection, QueryResult } from "kysely";
import oracledb, { Connection, ExecuteOptions, Result } from "oracledb";
import { isIntervalSupported } from "../features.js";
import { OracleLog } from "./logger.js";
import { OracleCompiledQuery } from "./query-compiler.js";

export interface OracleQueryResult<R = unknown, O = unknown> extends QueryResult<R> {
    outBinds?: O;
}

export class OracleConnection implements DatabaseConnection {
    #executeOptions: ExecuteOptions;
    #connection: Connection;
    #identifier: string;
    #log: OracleLog;

    #isTransactionActive = false;

    constructor(connection: Connection, log: OracleLog, executeOptions?: ExecuteOptions) {
        this.#executeOptions = executeOptions || {};
        this.#connection = connection;
        this.#log = log;
        this.#identifier = crypto.randomUUID();
    }

    async executeQuery<R>(compiledQuery: OracleCompiledQuery): Promise<OracleQueryResult<R>> {
        const startTime = performance.now();

        const executeOptions = {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            ...this.#executeOptions,
            ...compiledQuery.executeOptions,
        };

        if (this.#isTransactionActive) {
            executeOptions.autoCommit = false;
        }

        const { sql, bindParams } = this.formatQuery(compiledQuery);

        let result: Result<R>;

        try {
            result = await this.#connection.execute<R>(sql, bindParams, executeOptions);
        } catch (error) {
            await this.#log.log("error", () => ({
                level: "error",
                connectionId: this.#identifier,
                error,
                query: compiledQuery,
                queryDurationMillis: performance.now() - startTime,
            }));

            throw error;
        }

        await this.#log.log("query", () => ({
            level: "query",
            connectionId: this.#identifier,
            query: compiledQuery,
            queryDurationMillis: performance.now() - startTime,
        }));

        return {
            rows: compiledQuery.returningColumns
                ? await this.formatReturningRows<R>(compiledQuery.returningColumns, result.outBinds)
                : result?.rows || [],
            numAffectedRows: result.rowsAffected ? BigInt(result.rowsAffected) : undefined,
            outBinds: result.outBinds,
        };
    }

    async formatReturningRows<R>(columns: string[], outBinds: unknown): Promise<R[]> {
        if (!Array.isArray(outBinds) || outBinds.length < columns.length) {
            throw new Error("Unexpected out binds for `returning ... into`.");
        }

        const values = outBinds.slice(-columns.length);

        if (!values.every(Array.isArray)) {
            throw new Error("Unexpected out binds for `returning ... into`.");
        }

        const rows = (values[0] ?? []).map((_, rowIndex) =>
            Promise.all(
                columns.map(async (column, columnIndex) => [
                    column,
                    await this.formatReturningValue(values[columnIndex][rowIndex]),
                ]),
            ),
        );

        return (await Promise.all(rows)).map((entries) => Object.fromEntries(entries) as R);
    }

    /**
     * Reads LOBs as a string or buffer when `oracledb.fetchAsString` or `oracledb.fetchAsBuffer`
     * include their type, so returned values match what a query would fetch.
     */
    async formatReturningValue(value: unknown) {
        if (!(value instanceof oracledb.Lob)) {
            return value;
        }

        const fetchAs: unknown[] = [...(oracledb.fetchAsString ?? []), ...(oracledb.fetchAsBuffer ?? [])];

        return fetchAs.includes(value.type) ? value.getData() : value;
    }

    formatQuery(query: CompiledQuery) {
        return {
            sql: query.sql,
            bindParams: query.parameters.map((param) => this.formatBindParam(param)),
        };
    }

    formatBindParam(param: unknown) {
        if (isIntervalSupported() && param instanceof oracledb.IntervalYM) {
            return {
                dir: oracledb.BIND_IN,
                type: oracledb.DB_TYPE_INTERVAL_YM,
                val: param,
            };
        }
        if (isIntervalSupported() && param instanceof oracledb.IntervalDS) {
            return {
                dir: oracledb.BIND_IN,
                type: oracledb.DB_TYPE_INTERVAL_DS,
                val: param,
            };
        }
        return param;
    }

    streamQuery<R>(_compiledQuery: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
        throw new Error("Not implemented");
    }

    get identifier(): string {
        return this.#identifier;
    }

    get connection(): Connection {
        return this.#connection;
    }

    beginTransaction(): void {
        this.#isTransactionActive = true;
    }

    endTransaction(): void {
        this.#isTransactionActive = false;
    }
}
