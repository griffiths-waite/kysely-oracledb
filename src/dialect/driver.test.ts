import oracledb from "oracledb";
import { describe, expect, it, vi } from "vitest";
import { OracleDialect } from "./dialect";

describe("OracleDriver", () => {
    it("add the connection to the map when aquiring a new connection", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const { identifier } = await driver.acquireConnection();

        const connection = driver.getConnection(identifier);

        expect(connection).toBeDefined();
    });
    it("remove the connection from the map when releasing a connection", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        await driver.releaseConnection(connection);

        const deletedConnection = driver.getConnection(connection.identifier);

        expect(deletedConnection).toBeUndefined();
    });
    it("remove all connections when destroying the connection pool", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        await driver.destroy();

        const deletedConnection = driver.getConnection(connection.identifier);

        expect(deletedConnection).toBeUndefined();
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
        const spy = vi.spyOn(connection.connection, "execute").mockResolvedValue(undefined);
        const dummyCompile = (() => {}) as any;
        await driver.savepoint(connection, "sp1", dummyCompile);
        expect(spy).toHaveBeenCalledWith("SAVEPOINT sp1");
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
        const spy = vi.spyOn(connection.connection, "execute").mockResolvedValue(undefined);
        const dummyCompile = (() => {}) as any;
        await driver.rollbackToSavepoint(connection, "sp1", dummyCompile);
        expect(spy).toHaveBeenCalledWith("ROLLBACK TO SAVEPOINT sp1");
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
        const spy = vi.spyOn(connection.connection, "execute").mockResolvedValue(undefined);
        const dummyCompile = (() => {}) as any;
        await driver.releaseSavepoint(connection, "sp1", dummyCompile);
        expect(spy).toHaveBeenCalledWith("RELEASE SAVEPOINT sp1");
        spy.mockRestore();
    });
});
