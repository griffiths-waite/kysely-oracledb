import { RootOperationNode } from "kysely";
import oracledb from "oracledb";
import { describe, expect, it, vi } from "vitest";
import { OracleDialect } from "./dialect";

describe("OracleConnection", () => {
    it("should be initialised with a unique identifier", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        expect(connection.identifier).toBeDefined();
    });
    it("should return rows when executing a query", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const mockedExecute = vi.spyOn(connection.connection, "execute").mockImplementation(async () => {
            return {
                rows: [{ id: 1 }],
                rowsAffected: 0,
            };
        });

        const result = await connection.executeQuery({
            sql: "select * from dual",
            parameters: [],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
        });

        expect(result.rows).toEqual([{ id: 1 }]);

        mockedExecute.mockRestore();
    });
    it("should return rows affected when executing a query", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const mockedExecute = vi.spyOn(connection.connection, "execute").mockImplementation(async () => {
            return {
                rows: [],
                rowsAffected: 1,
            };
        });

        const result = await connection.executeQuery({
            sql: "select * from dual",
            parameters: [],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
        });

        expect(result.numAffectedRows).toEqual(BigInt(1));

        mockedExecute.mockRestore();
    });
    it("should format a query with bind params for logging", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const sql = connection.formatQueryForLogging({
            sql: "select :1 from dual",
            parameters: ["id"],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
        });

        expect(sql).toBe("select 'id' from dual");
    });
    it("should format date bind param for logging", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const sql = connection.formatQueryForLogging({
            sql: "select :1 from dual",
            parameters: [new Date("2024-01-01T00:00:00Z")],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
        });

        expect(sql).toBe("select TO_DATE('2024-01-01 00:00:00.000', 'YYYY-MM-DD HH24:MI:SS') from dual");
    });
    it("should format timestamp bind param for logging", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const sql = connection.formatQueryForLogging({
            sql: "select :1 from dual",
            parameters: [new Date("2024-01-01T00:00:00.100Z")],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
        });

        expect(sql).toBe("select TO_TIMESTAMP('2024-01-01 00:00:00.100', 'YYYY-MM-DD HH24:MI:SS.FF3') from dual");
    });
    it("should throw an error for stream query as it is not implemented", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        expect(() =>
            connection.streamQuery({
                sql: "select $1 from dual",
                parameters: ["id"],
                query: {} as RootOperationNode,
                queryId: { queryId: "test-id" },
            }),
        ).toThrow("Not implemented");
    });
    it("should pass compiled query execute options to oracledb execute", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const mockedExecute = vi.spyOn(connection.connection, "execute").mockImplementation(async () => {
            return {
                rows: [{ id: 1 }],
                rowsAffected: 0,
            };
        });

        await connection.executeQuery({
            sql: "select * from dual",
            parameters: [],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
            executeOptions: { autoCommit: true },
        });

        expect(mockedExecute).toHaveBeenCalledWith(
            "select * from dual",
            [],
            expect.objectContaining({ autoCommit: true }),
        );

        mockedExecute.mockRestore();
    });
});
