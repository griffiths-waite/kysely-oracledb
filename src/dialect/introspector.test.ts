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
                rows: [{ USERNAME: "SYS" }],
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
            'select "USERNAME" from "ALL_USERS" where (:1 = :2 or "USERNAME" in (:3)) fetch first :4 rows only',
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
                rows: [{ USERNAME: "SYS" }],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        OWNER: "SYS",
                        TABLE_NAME: "DUAL",
                    },
                ],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        OWNER: "SYS",
                        TABLE_NAME: "DUAL",
                        COLUMN_NAME: "DUMMY",
                        DATA_TYPE: "VARCHAR2",
                        DATA_LENGTH: 1,
                        DATA_PRECISION: null,
                        DATA_SCALE: null,
                        NULLABLE: "Y",
                        DATA_DEFAULT: null,
                        IDENTITY_COLUMN: null,
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
            'select "USERNAME" from "ALL_USERS" where (:1 = :2 or "USERNAME" in (:3)) fetch first :4 rows only',
            [0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            2,
            'select "OWNER", "TABLE_NAME" from "ALL_TABLES" where "OWNER" in (:1) and (:2 = :3 or "TABLE_NAME" in (:4)) fetch first :5 rows only',
            ["SYS", 0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            3,
            'select "OWNER", "TABLE_NAME", "COLUMN_NAME", "DATA_TYPE", "DATA_LENGTH", "DATA_PRECISION", "DATA_SCALE", "NULLABLE", "DATA_DEFAULT", "IDENTITY_COLUMN" from "ALL_TAB_COLUMNS" where "OWNER" in (:1, :2) and "TABLE_NAME" in (:3)',
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
                rows: [{ USERNAME: "SYS" }],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        OWNER: "SYS",
                        VIEW_NAME: "DUAL",
                    },
                ],
                rowsAffected: 0,
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        OWNER: "SYS",
                        TABLE_NAME: "DUAL",
                        COLUMN_NAME: "DUMMY",
                        DATA_TYPE: "VARCHAR2",
                        NULLABLE: "Y",
                        DATA_DEFAULT: null,
                        IDENTITY_COLUMN: null,
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
            'select "USERNAME" from "ALL_USERS" where (:1 = :2 or "USERNAME" in (:3)) fetch first :4 rows only',
            [0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            2,
            'select "OWNER", "VIEW_NAME" from "ALL_VIEWS" where "OWNER" in (:1) and (:2 = :3 or "VIEW_NAME" in (:4)) fetch first :5 rows only',
            ["SYS", 0, 0, null, 999],
            expect.anything(),
        );
        expect(mockedExecute).toHaveBeenNthCalledWith(
            3,
            'select "OWNER", "TABLE_NAME", "COLUMN_NAME", "DATA_TYPE", "NULLABLE", "DATA_DEFAULT", "IDENTITY_COLUMN" from "ALL_TAB_COLUMNS" where "OWNER" in (:1) and "TABLE_NAME" in (:2)',
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
