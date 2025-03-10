import { CompiledQuery, DatabaseConnection, QueryResult } from "kysely";
import oracledb, { Connection, ExecuteOptions } from "oracledb";
import { v4 as uuid } from "uuid";
import { Logger } from "./logger.js";

export class OracleConnection implements DatabaseConnection {
    #executeOptions: ExecuteOptions;
    #connection: Connection;
    #identifier: string;
    #log: Logger;

    constructor(connection: Connection, logger: Logger, executeOptions?: ExecuteOptions) {
        this.#executeOptions = executeOptions || {};
        this.#connection = connection;
        this.#log = logger;
        this.#identifier = uuid();
    }

    async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
        const { sql, bindParams } = this.formatQuery(compiledQuery);
        const startTime = new Date();
        this.#log.debug({ sql: this.formatQueryForLogging(compiledQuery) }, "Executing query");
        const result = await this.#connection.execute<R>(sql, bindParams, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            fetchTypeHandler: (metaData) => {
                metaData.name = metaData.name.toLowerCase();
                return undefined;
            },
            ...this.#executeOptions,
        });
        const endTime = new Date();
        this.#log.debug({ durationMs: endTime.getTime() - startTime.getTime() }, "Execution complete");
        return {
            rows: result?.rows || [],
            numAffectedRows: result.rowsAffected ? BigInt(result.rowsAffected) : undefined,
        };
    }

    formatQuery(query: CompiledQuery) {
        return {
            sql: query.sql.replace(/\$(\d+)/g, (_match, p1) => `:${parseInt(p1, 10) - 1}`), // format bind params in Oracle syntax :0, :1, etc.
            bindParams: query.parameters as unknown[],
        };
    }

    formatQueryForLogging(query: CompiledQuery) {
        return query.sql.replace(/\$(\d+)/g, (_match, p1) => {
            const index = parseInt(p1, 10);
            const param = query.parameters[index - 1];
            return typeof param === "string" ? `'${param}'` : (param?.toString() ?? "null");
        });
    }

    async *streamQuery<R>(compiledQuery: CompiledQuery, chunkSize: number = 1): AsyncIterableIterator<QueryResult<R>> {
        if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
            throw new Error('chunkSize must be a positive integer')
        }
        const { sql, bindParams } = this.formatQuery(compiledQuery);
        this.#log.debug({ sql: this.formatQueryForLogging(compiledQuery) }, "Executing query");
        const result = await this.#connection.execute<R>(sql, bindParams, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            fetchTypeHandler: (metaData) => {
                metaData.name = metaData.name.toLowerCase();
                return undefined;
            },
            ...this.#executeOptions,
            resultSet: true,
        });
        const stream = result.resultSet!.toQueryStream()
        let rows: R[] = []

        for await (const row of stream) {
            rows.push(row)
            if (rows.length >= chunkSize) {
                yield {
                    rows
                }
                rows = []
            }
        }
        yield {
            rows
        }
    }

    get identifier(): string {
        return this.#identifier;
    }

    get connection(): Connection {
        return this.#connection;
    }
}
