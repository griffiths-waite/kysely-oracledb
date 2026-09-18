import { Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import { OracleDialect } from "../../dialect/dialect";
import { OracleIntrospector } from "../../dialect/introspector";
import { DB } from "./fixtures/types-snake-case";

describe("introspector", () => {
    it("should return all database schemas", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
            }),
        });

        const schemas = await db.introspection.getSchemas();

        expect(schemas.length).toBeGreaterThan(1);
    });

    it("should return filtered database schemas", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                generator: {
                    schemas: [context.testId],
                },
            }),
        });

        const schemas = await db.introspection.getSchemas();

        expect(schemas.length).toBe(1);
    });

    it("should return database schema metadata", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                generator: {
                    schemas: [context.testId],
                },
            }),
        });

        const [schema] = await db.introspection.getSchemas();

        expect(schema).toEqual({ name: context.testId });
    });

    it("should return all database tables", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
            }),
        });

        const tables = await db.introspection.getTables();

        expect(tables.length).toBeGreaterThan(2);
    });

    it("should return filtered database tables", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                generator: {
                    schemas: [context.testId],
                    type: "tables",
                    tables: ["ITEMS"],
                },
            }),
        });

        const tables = await db.introspection.getTables();

        expect(tables.length).toEqual(2);
    });

    it("should return filtered database views", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                generator: {
                    schemas: [context.testId],
                    type: "views",
                    tables: ["ACTIVE_ITEMS"],
                },
            }),
        });

        const tables = await db.introspection.getTables();

        expect(tables.length).toEqual(1);
    });

    it("should return the database table metadata", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                generator: {
                    schemas: [context.testId, "SYS"],
                    type: "tables",
                    tables: ["ITEMS"],
                },
            }),
        });

        const [table] = await db.introspection.getTables();

        expect(table).toEqual({
            schema: context.testId,
            name: "ITEMS",
            isView: false,
            isForeign: false,
            columns: [
                {
                    dataLength: 22,
                    dataPrecision: null,
                    dataScale: null,
                    dataType: "NUMBER",
                    hasDefaultValue: true,
                    isAutoIncrementing: true,
                    isNullable: false,
                    name: "ID",
                },
                {
                    dataLength: 255,
                    dataPrecision: null,
                    dataScale: null,
                    dataType: "VARCHAR2",
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                    isNullable: false,
                    name: "NAME",
                },
                {
                    dataLength: 1,
                    dataPrecision: null,
                    dataScale: null,
                    dataType: "CHAR",
                    hasDefaultValue: true,
                    isAutoIncrementing: false,
                    isNullable: false,
                    name: "CODE",
                },
                {
                    dataLength: 22,
                    dataPrecision: 10,
                    dataScale: 2,
                    dataType: "NUMBER",
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                    isNullable: true,
                    name: "AMOUNT",
                },
                {
                    dataLength: 4000,
                    dataPrecision: null,
                    dataScale: null,
                    dataType: "CLOB",
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                    isNullable: true,
                    name: "NOTES",
                },
                {
                    dataLength: 7,
                    dataPrecision: null,
                    dataScale: null,
                    dataType: "DATE",
                    hasDefaultValue: true,
                    isAutoIncrementing: false,
                    isNullable: false,
                    name: "CREATED_AT",
                },
                {
                    dataLength: 7,
                    dataPrecision: null,
                    dataScale: null,
                    dataType: "DATE",
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                    isNullable: true,
                    name: "UPDATED_AT",
                },
            ],
        });
    });

    it("should return the database view metadata", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                generator: {
                    type: "views",
                    schemas: [context.testId],
                    views: ["ACTIVE_ITEMS"],
                },
            }),
        });

        const [view] = await (db.introspection as OracleIntrospector).getViews();

        expect(view).toEqual({
            schema: context.testId,
            name: "ACTIVE_ITEMS",
            isView: true,
            isForeign: false,
            columns: [
                {
                    dataType: "NUMBER",
                    hasDefaultValue: false,
                    isAutoIncrementing: true,
                    isNullable: false,
                    name: "ID",
                },
                {
                    dataType: "VARCHAR2",
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                    isNullable: false,
                    name: "NAME",
                },
            ],
        });
    });
});
