import { createQueryId, Driver, QueryCompiler } from "kysely";
import { parseSavepointCommand } from "../parser/savepoint-parser.js";
import { OracleConnection } from "./connection.js";
import { OracleDialectConfig } from "./dialect.js";
import { defaultLogger, Logger } from "./logger.js";

export class OracleDriver implements Driver {
    readonly #config: OracleDialectConfig;
    readonly #log: Logger;

    constructor(config: OracleDialectConfig) {
        this.#config = config;
        this.#log = config.logger ? config.logger : defaultLogger;
    }

    async init(): Promise<void> {}

    async acquireConnection(): Promise<OracleConnection> {
        this.#log.debug("Acquiring connection");
        const connection = new OracleConnection(
            await this.#config.pool.getConnection(),
            this.#log,
            this.#config.executeOptions,
        );
        this.#log.debug({ id: connection.identifier }, "Connection acquired");
        return connection;
    }

    async beginTransaction(connection: OracleConnection): Promise<void> {
        this.#log.debug({ id: connection.identifier }, "Beginning transaction");
        connection.beginTransaction();
    }

    async commitTransaction(connection: OracleConnection): Promise<void> {
        try {
            await connection.connection.commit();
            this.#log.debug({ id: connection.identifier }, "Transaction committed");
        } finally {
            connection.endTransaction();
        }
    }

    async rollbackTransaction(connection: OracleConnection): Promise<void> {
        try {
            await connection.connection.rollback();
            this.#log.debug({ id: connection.identifier }, "Transaction rolled back");
        } finally {
            connection.endTransaction();
        }
    }

    async savepoint(
        connection: OracleConnection,
        savepoint: string,
        compileQuery: QueryCompiler["compileQuery"],
    ): Promise<void> {
        this.#log.debug({ id: connection.identifier, savepoint }, "Creating savepoint");
        await connection.executeQuery(compileQuery(parseSavepointCommand("SAVEPOINT", savepoint), createQueryId()));
        this.#log.debug({ id: connection.identifier, savepoint }, "Savepoint created");
    }

    async rollbackToSavepoint(
        connection: OracleConnection,
        savepoint: string,
        compileQuery: QueryCompiler["compileQuery"],
    ): Promise<void> {
        this.#log.debug({ id: connection.identifier, savepoint }, "Rolling back to savepoint");
        await connection.executeQuery(
            compileQuery(parseSavepointCommand("ROLLBACK TO SAVEPOINT", savepoint), createQueryId()),
        );
        this.#log.debug({ id: connection.identifier, savepoint }, "Rolled back to savepoint");
    }

    async releaseConnection(connection: OracleConnection): Promise<void> {
        this.#log.debug({ id: connection.identifier }, "Releasing connection");
        try {
            await connection.connection.close();
            this.#log.debug({ id: connection.identifier }, "Connection released");
        } catch (err) {
            this.#log.error({ id: connection.identifier, err }, "Error closing connection");
        }
    }

    async destroy(): Promise<void> {
        await this.#config.pool?.close();
    }
}
