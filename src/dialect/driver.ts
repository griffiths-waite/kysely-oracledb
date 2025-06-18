import { Driver, QueryCompiler } from "kysely";
import { Connection } from "oracledb";
import { OracleConnection } from "./connection.js";
import { OracleDialectConfig } from "./dialect.js";
import { defaultLogger, Logger } from "./logger.js";

export class OracleDriver implements Driver {
    readonly #config: OracleDialectConfig;
    readonly #connections = new Map<string, OracleConnection>();
    readonly #log: Logger;

    constructor(config: OracleDialectConfig) {
        this.#config = config;
        this.#log = config.logger ? config.logger : defaultLogger;
    }

    async init(): Promise<void> {}

    async acquireConnection(): Promise<OracleConnection> {
        this.#log.debug("Acquiring connection");
        const connection = new OracleConnection(
            (await this.#config.pool?.getConnection()) as Connection,
            this.#log,
            this.#config.executeOptions,
        );
        this.#connections.set(connection.identifier, connection);
        this.#log.debug({ id: connection.identifier }, "Connection acquired");
        return connection;
    }

    async beginTransaction(connection: OracleConnection): Promise<void> {
        this.#log.debug({ id: connection.identifier }, "Beginning transaction");
    }

    async commitTransaction(connection: OracleConnection): Promise<void> {
        await connection.connection.commit();
        this.#log.debug({ id: connection.identifier }, "Transaction committed");
    }

    async rollbackTransaction(connection: OracleConnection): Promise<void> {
        await connection.connection.rollback();
        this.#log.debug({ id: connection.identifier }, "Transaction rolled back");
    }

    async savepoint(
        connection: OracleConnection,
        savepoint: string,
        compileQuery: QueryCompiler["compileQuery"],
    ): Promise<void> {
        this.#log.debug({ id: connection.identifier, savepoint }, "Creating savepoint");
        await connection.connection.execute(`SAVEPOINT ${savepoint}`);
        this.#log.debug({ id: connection.identifier, savepoint }, "Savepoint created");
    }

    async rollbackToSavepoint(
        connection: OracleConnection,
        savepoint: string,
        compileQuery: QueryCompiler["compileQuery"],
    ): Promise<void> {
        this.#log.debug({ id: connection.identifier, savepoint }, "Rolling back to savepoint");
        await connection.connection.execute(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.#log.debug({ id: connection.identifier, savepoint }, "Rolled back to savepoint");
    }

    async releaseSavepoint(
        connection: OracleConnection,
        savepoint: string,
        compileQuery: QueryCompiler["compileQuery"],
    ): Promise<void> {
        this.#log.debug({ id: connection.identifier, savepoint }, "Releasing savepoint");
        await connection.connection.execute(`RELEASE SAVEPOINT ${savepoint}`);
        this.#log.debug({ id: connection.identifier, savepoint }, "Savepoint released");
    }

    async releaseConnection(connection: OracleConnection): Promise<void> {
        this.#log.debug({ id: connection.identifier }, "Releasing connection");
        try {
            await this.#connections.get(connection.identifier)?.connection.close();
            this.#connections.delete(connection.identifier);
            this.#log.debug({ id: connection.identifier }, "Connection released");
        } catch (err) {
            this.#log.error({ id: connection.identifier, err }, "Error closing connection");
        }
    }

    async destroy(): Promise<void> {
        for (const connection of this.#connections.values()) {
            await this.releaseConnection(connection as OracleConnection);
        }
        await this.#config.pool?.close();
    }

    getConnection(id: string) {
        return this.#connections.get(id.toString());
    }
}
