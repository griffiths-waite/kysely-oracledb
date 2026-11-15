import { CompiledQuery, DatabaseConnection, QueryResult } from "kysely";
import oracledb, { Connection, ExecuteOptions, Result } from "oracledb";
import { isIntervalSupported } from "../features.js";
import { OracleLog } from "./logger.js";
import { OracleCompiledQuery } from "./query-compiler.js";

export interface OracleQueryResult<R = unknown> extends QueryResult<R> {
    outBinds?: R;
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
            rows: result?.rows || [],
            numAffectedRows: result.rowsAffected ? BigInt(result.rowsAffected) : undefined,
            outBinds: result.outBinds,
        };
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
