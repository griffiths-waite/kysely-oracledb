import { Kysely } from "kysely";
import oracledb from "oracledb";
import { describe, expect, it, vi } from "vitest";
import { OracleDialect } from "./dialect";
import { IntropsectorDB } from "./introspector";

describe("OracleIntrospector", () => {
    it("returns schema metadata", async () => {
        const pool = await oracledb.createPool({
            user: process.env.DB_USER,
        });

        const mockedExecute = vi.fn(() => {
            return {
                rows: [{ username: "SYS" }],
                rowsAffected: 0,
            };
        });

        vi.spyOn(pool, "getConnection").mockImplementation(async () => {
            return {
                close: vi.fn(),
                execute: mockedExecute,
            };
        });

        const dialect = new OracleDialect({
            pool,
        });

        const db = new Kysely<IntropsectorDB>({ dialect });

        const intropsector = dialect.createIntrospector(db);

        const schemas = await intropsector.getSchemas();

        expect(mockedExecute).toHaveBeenCalledWith(
            "select username from all_users where (:1 = :2 or username in (:3)) fetch first :4 rows only",
            [0, 0, null, 999],
            expect.anything(),
        );

        expect(schemas).toEqual([{ name: "SYS" }]);
    });
    it("returns table metadata", async () => {
        const pool = await oracledb.createPool({
            user: process.env.DB_USER,
        });

        const mockedExecute = vi
            .fn()
            .mockResolvedValueOnce({
                rows: [{ username: "SYS" }],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        owner: "SYS",
                        table_name: "DUAL",
                    },
                ],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        owner: "SYS",
                        table_name: "DUAL",
                        column_name: "DUMMY",
                        data_type: "VARCHAR2",
                        data_length: 1,
                        data_precision: null,
                        data_scale: null,
                        nullable: "Y",
                        data_default: null,
                        identity_column: null,
                    },
                ],
                rowsAffected: 0,
            });

        vi.spyOn(pool, "getConnection").mockImplementation(async () => {
            return {
                close: vi.fn(),
                execute: mockedExecute,
            };
        });

        const dialect = new OracleDialect({
            pool,
        });

        const db = new Kysely<IntropsectorDB>({ dialect });

        const intropsector = dialect.createIntrospector(db);

        const tables = await intropsector.getTables();

        expect(mockedExecute).toHaveBeenNthCalledWith(
            1,
            "select username from all_users where (:1 = :2 or username in (:3)) fetch first :4 rows only",
            [0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            2,
            "select owner, table_name from all_tables where owner in (:1) and (:2 = :3 or table_name in (:4)) fetch first :5 rows only",
            ["SYS", 0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            3,
            "select owner, table_name, column_name, data_type, data_length, data_precision, data_scale, nullable, data_default, identity_column from all_tab_columns where owner in (:1, :2) and table_name in (:3)",
            ["SYS", "SYS", "DUAL"],
            expect.anything(),
        );

        expect(tables).toEqual([
            {
                schema: "SYS",
                name: "DUAL",
                isView: false,
                columns: [
                    {
                        name: "DUMMY",
                        dataType: "VARCHAR2",
                        dataLength: 1,
                        dataPrecision: null,
                        dataScale: null,
                        isNullable: true,
                        hasDefaultValue: false,
                        isAutoIncrementing: false,
                    },
                ],
            },
        ]);
    });
    it("returns view metadata", async () => {
        const pool = await oracledb.createPool({
            user: process.env.DB_USER,
        });

        const mockedExecute = vi
            .fn()
            .mockResolvedValueOnce({
                rows: [{ username: "SYS" }],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        owner: "SYS",
                        view_name: "DUAL",
                    },
                ],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        owner: "SYS",
                        table_name: "DUAL",
                        column_name: "DUMMY",
                        data_type: "VARCHAR2",
                        nullable: "Y",
                        data_default: null,
                        identity_column: null,
                    },
                ],
                rowsAffected: 0,
            });

        vi.spyOn(pool, "getConnection").mockImplementation(async () => {
            return {
                close: vi.fn(),
                execute: mockedExecute,
            };
        });

        const dialect = new OracleDialect({
            pool,
        });

        const db = new Kysely<IntropsectorDB>({ dialect });

        const intropsector = dialect.createIntrospector(db);

        const views = await intropsector.getViews();

        expect(mockedExecute).toHaveBeenNthCalledWith(
            1,
            "select username from all_users where (:1 = :2 or username in (:3)) fetch first :4 rows only",
            [0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            2,
            "select owner, view_name from all_views where owner in (:1) and (:2 = :3 or view_name in (:4)) fetch first :5 rows only",
            ["SYS", 0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            3,
            "select owner, table_name, column_name, data_type, nullable, data_default, identity_column from all_tab_columns where owner in (:1) and table_name in (:2)",
            ["SYS", "DUAL"],
            expect.anything(),
        );

        expect(views).toEqual([
            {
                schema: "SYS",
                name: "DUAL",
                isView: true,
                columns: [
                    {
                        name: "DUMMY",
                        dataType: "VARCHAR2",
                        isNullable: true,
                        hasDefaultValue: false,
                        isAutoIncrementing: false,
                    },
                ],
            },
        ]);
    });
});
