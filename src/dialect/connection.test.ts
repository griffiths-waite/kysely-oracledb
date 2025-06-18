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
    it("should format a query in Oracle syntax", async () => {
        const dialect = new OracleDialect({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
        });

        const driver = dialect.createDriver();

        const connection = await driver.acquireConnection();

        const formattedQuery = connection.formatQuery({
            sql: "select $1 from dual",
            parameters: ["id"],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
        });

        expect(formattedQuery.sql).toBe("select :0 from dual");
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
            sql: "select $1 from dual",
            parameters: ["id"],
            query: {} as RootOperationNode,
            queryId: { queryId: "test-id" },
        });

        expect(sql).toBe("select 'id' from dual");
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
});
