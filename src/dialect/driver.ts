import { createQueryId, Driver, QueryCompiler } from "kysely";
import { parseSavepointCommand } from "../parser/savepoint-parser.js";
import { OracleConnection } from "./connection.js";
import { OracleDialectConfig } from "./dialect.js";
import { OracleLog } from "./logger.js";

export class OracleDriver implements Driver {
    readonly #config: OracleDialectConfig;
    readonly #log: OracleLog;

    constructor(config: OracleDialectConfig) {
        this.#config = config;
        this.#log = new OracleLog(config.log);
    }

    async init(): Promise<void> {}

    async acquireConnection(): Promise<OracleConnection> {
        const startTime = performance.now();
        const connection = new OracleConnection(
            await this.#config.pool.getConnection(),
            this.#log,
            this.#config.executeOptions,
        );
        await this.#log.log("connection", () => ({
            level: "connection",
            connectionId: connection.identifier,
            action: "acquire",
            durationMillis: performance.now() - startTime,
        }));
        return connection;
    }

    async beginTransaction(connection: OracleConnection): Promise<void> {
        connection.beginTransaction();
        await this.#log.log("transaction", () => ({
            level: "transaction",
            connectionId: connection.identifier,
            action: "begin",
        }));
    }

    async commitTransaction(connection: OracleConnection): Promise<void> {
        await this.#endTransaction(connection, "commit", () => connection.connection.commit());
    }

    async rollbackTransaction(connection: OracleConnection): Promise<void> {
        await this.#endTransaction(connection, "rollback", () => connection.connection.rollback());
    }

    async savepoint(
        connection: OracleConnection,
        savepoint: string,
        compileQuery: QueryCompiler["compileQuery"],
    ): Promise<void> {
        const startTime = performance.now();
        await connection.executeQuery(compileQuery(parseSavepointCommand("SAVEPOINT", savepoint), createQueryId()));
        await this.#log.log("transaction", () => ({
            level: "transaction",
            connectionId: connection.identifier,
            action: "savepoint",
            savepoint,
            durationMillis: performance.now() - startTime,
        }));
    }

    async rollbackToSavepoint(
        connection: OracleConnection,
        savepoint: string,
        compileQuery: QueryCompiler["compileQuery"],
    ): Promise<void> {
        const startTime = performance.now();
        await connection.executeQuery(
            compileQuery(parseSavepointCommand("ROLLBACK TO SAVEPOINT", savepoint), createQueryId()),
        );
        await this.#log.log("transaction", () => ({
            level: "transaction",
            connectionId: connection.identifier,
            action: "rollbackToSavepoint",
            savepoint,
            durationMillis: performance.now() - startTime,
        }));
    }

    async releaseConnection(connection: OracleConnection): Promise<void> {
        const startTime = performance.now();
        try {
            await connection.connection.close();
        } catch (error) {
            await this.#log.log("error", () => ({ level: "error", connectionId: connection.identifier, error }));
            return;
        }
        await this.#log.log("connection", () => ({
            level: "connection",
            connectionId: connection.identifier,
            action: "release",
            durationMillis: performance.now() - startTime,
        }));
    }

    async destroy(): Promise<void> {
        await this.#config.pool?.close();
    }

    async #endTransaction(
        connection: OracleConnection,
        action: "commit" | "rollback",
        end: () => Promise<void>,
    ): Promise<void> {
        const startTime = performance.now();
        try {
            await end();
        } catch (error) {
            await this.#log.log("error", () => ({ level: "error", connectionId: connection.identifier, error }));
            throw error;
        } finally {
            connection.endTransaction();
        }
        await this.#log.log("transaction", () => ({
            level: "transaction",
            connectionId: connection.identifier,
            action,
            durationMillis: performance.now() - startTime,
        }));
    }
}
