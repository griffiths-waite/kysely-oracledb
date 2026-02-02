import { CompiledQuery, DatabaseConnection, QueryResult } from "kysely";
import oracledb, { Connection, ExecuteOptions } from "oracledb";
import { isIntervalSupported } from "../generator/map.js";
import { Logger } from "./logger.js";
import { OracleCompiledQuery } from "./query-compiler.js";

export interface OracleQueryResult<R = unknown> extends QueryResult<R> {
    outBinds?: R;
}

export class OracleConnection implements DatabaseConnection {
    #executeOptions: ExecuteOptions;
    #connection: Connection;
    #identifier: string;
    #log: Logger;

    constructor(connection: Connection, logger: Logger, executeOptions?: ExecuteOptions) {
        this.#executeOptions = executeOptions || {};
        this.#connection = connection;
        this.#log = logger;
        this.#identifier = crypto.randomUUID();
    }

    async executeQuery<R>(compiledQuery: OracleCompiledQuery): Promise<OracleQueryResult<R>> {
        const startTime = new Date();

        const { sql, bindParams } = this.formatQuery(compiledQuery);

        this.#log.debug({ sql: this.formatQueryForLogging(compiledQuery), id: this.#identifier }, "Executing query");

        try {
            const result = await this.#connection.execute<R>(sql, bindParams, {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                ...this.#executeOptions,
                ...compiledQuery.executeOptions,
            });

            const endTime = new Date();

            this.#log.debug(
                { durationMs: endTime.getTime() - startTime.getTime(), id: this.#identifier },
                "Execution complete",
            );

            return {
                rows: result?.rows || [],
                numAffectedRows: result.rowsAffected ? BigInt(result.rowsAffected) : undefined,
                outBinds: result.outBinds,
            };
        } catch (err) {
            const endTime = new Date();

            this.#log.error(
                { err, durationMs: endTime.getTime() - startTime.getTime(), id: this.#identifier },
                "Error executing query",
            );

            throw err;
        }
    }

    formatQuery(query: CompiledQuery) {
        return {
            sql: query.sql,
            bindParams: query.parameters.map((param) => this.formatBindParam(param)),
        };
    }

    formatBindParam(param: unknown) {
        if (isIntervalSupported && param instanceof oracledb.IntervalYM) {
            return {
                dir: oracledb.BIND_IN,
                type: oracledb.DB_TYPE_INTERVAL_YM,
                val: param,
            };
        }
        if (isIntervalSupported && param instanceof oracledb.IntervalDS) {
            return {
                dir: oracledb.BIND_IN,
                type: oracledb.DB_TYPE_INTERVAL_DS,
                val: param,
            };
        }
        return param;
    }

    formatQueryForLogging(query: CompiledQuery) {
        return query.sql.replace(/\:(\d+)/g, (_match, p1) => {
            const index = parseInt(p1, 10);
            const param = query.parameters[index - 1];

            if (param === null || param === undefined) {
                return "null";
            }

            if (param instanceof Date) {
                const isoString = param.toISOString().replace("Z", "");
                const [date, time] = isoString.split("T");
                const [timeWithoutMs, ms] = time.split(".");

                return ms && ms !== "000"
                    ? `TO_TIMESTAMP('${date} ${time}', 'YYYY-MM-DD HH24:MI:SS.FF3')`
                    : `TO_DATE('${date} ${timeWithoutMs}', 'YYYY-MM-DD HH24:MI:SS')`;
            }

            if (typeof param === "string") {
                return `'${param}'`;
            }

            return param.toString();
        });
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
}
