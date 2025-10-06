import { type QueryCompiler, DefaultQueryCompiler } from "kysely";
import oracledb from "oracledb";
import { describe, expect, it, vi } from "vitest";
import { OracleDialect } from "./dialect";

describe("OracleDriver", () => {
    it("creates oracledb connection when aquiring a new connection", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const { connection } = await driver.acquireConnection();

        expect(connection).toBeDefined();
    });
    it("call the connection commit method when commiting a transaction", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        await driver.commitTransaction(connection);

        expect(connection.connection.commit).toHaveBeenCalled();
    });
    it("call the connection rollback method when rolling back a transaction", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        await driver.rollbackTransaction(connection);

        expect(connection.connection.rollback).toHaveBeenCalled();
    });
    it("call the connection execute method with correct SQL when creating a savepoint", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const spy = vi.spyOn(connection, "executeQuery").mockResolvedValue({ rows: [] });

        const dummyCompile: QueryCompiler["compileQuery"] = (node, queryId) =>
            new DefaultQueryCompiler().compileQuery(node, queryId);

        await driver.savepoint(connection, "sp1", dummyCompile);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sql: 'SAVEPOINT "sp1"' }));

        spy.mockRestore();
    });

    it("call the connection execute method with correct SQL when rolling back to a savepoint", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const spy = vi.spyOn(connection, "executeQuery").mockResolvedValue({ rows: [] });

        const dummyCompile: QueryCompiler["compileQuery"] = (node, queryId) =>
            new DefaultQueryCompiler().compileQuery(node, queryId);

        await driver.rollbackToSavepoint(connection, "sp1", dummyCompile);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sql: 'ROLLBACK TO SAVEPOINT "sp1"' }));

        spy.mockRestore();
    });

    it("call the connection execute method with correct SQL when releasing a savepoint", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const spy = vi.spyOn(connection, "executeQuery").mockResolvedValue({ rows: [] });

        const dummyCompile: QueryCompiler["compileQuery"] = (node, queryId) =>
            new DefaultQueryCompiler().compileQuery(node, queryId);

        await driver.releaseSavepoint(connection, "sp1", dummyCompile);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sql: 'RELEASE SAVEPOINT "sp1"' }));

        spy.mockRestore();
    });
});
