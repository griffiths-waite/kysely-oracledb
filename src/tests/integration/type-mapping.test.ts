import { Kysely, sql } from "kysely";
import { describe, expect, it } from "vitest";
import { OracleDialect } from "../../dialect/dialect";
import { isIntervalSupported } from "../../features";
import { generateTypes } from "../../generator/generate";

const columns: Record<string, { definition: string; dataType: string; type: string }> = {
    C_VARCHAR2: { definition: "varchar2(10)", dataType: "VARCHAR2", type: "string" },
    C_NVARCHAR2: { definition: "nvarchar2(10)", dataType: "NVARCHAR2", type: "string" },
    C_CHAR: { definition: "char(1)", dataType: "CHAR", type: "string" },
    C_NCHAR: { definition: "nchar(1)", dataType: "NCHAR", type: "string" },
    C_CLOB: { definition: "clob", dataType: "CLOB", type: "string" },
    C_NCLOB: { definition: "nclob", dataType: "NCLOB", type: "string" },
    C_ROWID: { definition: "rowid", dataType: "ROWID", type: "string" },
    C_UROWID: { definition: "urowid", dataType: "UROWID", type: "string" },
    // Needs XDB, which the lite database image does not include (creating the column fails with ORA-00600).
    // C_XMLTYPE: { definition: "xmltype", dataType: "XMLTYPE", type: "string" },
    C_NUMBER: { definition: "number(10,2)", dataType: "NUMBER", type: "number" },
    C_INTEGER: { definition: "integer", dataType: "NUMBER", type: "number" },
    C_FLOAT: { definition: "float", dataType: "FLOAT", type: "number" },
    C_REAL: { definition: "real", dataType: "FLOAT", type: "number" },
    C_DOUBLE: { definition: "double precision", dataType: "FLOAT", type: "number" },
    C_BINARY_FLOAT: { definition: "binary_float", dataType: "BINARY_FLOAT", type: "number" },
    C_BINARY_DOUBLE: { definition: "binary_double", dataType: "BINARY_DOUBLE", type: "number" },
    C_BOOLEAN: { definition: "boolean", dataType: "BOOLEAN", type: "boolean" },
    C_DATE: { definition: "date", dataType: "DATE", type: "Date" },
    C_TIMESTAMP: { definition: "timestamp", dataType: "TIMESTAMP(6)", type: "Date" },
    C_TIMESTAMP_3: { definition: "timestamp(3)", dataType: "TIMESTAMP(3)", type: "Date" },
    C_TIMESTAMP_TZ: { definition: "timestamp with time zone", dataType: "TIMESTAMP(6) WITH TIME ZONE", type: "Date" },
    C_TIMESTAMP_LTZ: {
        definition: "timestamp with local time zone",
        dataType: "TIMESTAMP(6) WITH LOCAL TIME ZONE",
        type: "Date",
    },
    C_BLOB: { definition: "blob", dataType: "BLOB", type: "Buffer" },
    C_RAW: { definition: "raw(16)", dataType: "RAW", type: "Buffer" },
    C_BFILE: { definition: "bfile", dataType: "BFILE", type: "unknown" },
    C_INTERVAL_YM: {
        definition: "interval year(2) to month",
        dataType: "INTERVAL YEAR(2) TO MONTH",
        type: isIntervalSupported() ? "IntervalYM" : "unknown",
    },
    C_INTERVAL_DS: {
        definition: "interval day(2) to second(6)",
        dataType: "INTERVAL DAY(2) TO SECOND(6)",
        type: isIntervalSupported() ? "IntervalDS" : "unknown",
    },
    C_OBJECT: { definition: "TYPE_MAPPING_OBJECT", dataType: "TYPE_MAPPING_OBJECT", type: "unknown" },
};

const longColumns: typeof columns = {
    C_LONG: { definition: "long", dataType: "LONG", type: "string" },
};

const longRawColumns: typeof columns = {
    C_LONG_RAW: { definition: "long raw", dataType: "LONG RAW", type: "Buffer" },
};

const assmColumns: typeof columns = {
    C_JSON: { definition: "json", dataType: "JSON", type: "unknown" },
    C_VECTOR: {
        definition: "vector(3, float32)",
        dataType: "VECTOR",
        type: "Float32Array | Float64Array | Int8Array | Uint8Array",
    },
    C_VECTOR_ANY: {
        definition: "vector",
        dataType: "VECTOR",
        type: "Float32Array | Float64Array | Int8Array | Uint8Array",
    },
};

const allColumns = { ...columns, ...longColumns, ...longRawColumns, ...assmColumns };

const createTable = (name: string, definitions: typeof columns, tablespace?: string) =>
    sql.raw(
        `create table ${name} (${Object.entries(definitions)
            .map(([column, { definition }]) => `${column} ${definition} not null`)
            .join(", ")})${tablespace ? ` tablespace ${tablespace}` : ""}`,
    );

describe("type mapping", () => {
    it("should map every supported column type to its corresponding TypeScript type", async (context) => {
        const tablespace = `${context.testId.slice(0, 20)}_TS`;

        const dropTablespace = () =>
            sql
                .raw(`drop tablespace ${tablespace} including contents and datafiles`)
                .execute(context.db)
                .catch(() => undefined);

        await dropTablespace();

        // Create a tablespace with Automatic Segment Space Management (ASSM) which supporrts VECTOR and JSON columns
        await sql
            .raw(
                `create tablespace ${tablespace} datafile '${tablespace}.dbf' size 20m autoextend on next 10m segment space management auto`,
            )
            .execute(context.db);

        try {
            await sql`create type TYPE_MAPPING_OBJECT as object (VALUE number)`.execute(context.db);

            await createTable("TYPE_MAPPING", columns).execute(context.db);
            await createTable("TYPE_MAPPING_LONG", longColumns).execute(context.db);
            await createTable("TYPE_MAPPING_LONG_RAW", longRawColumns).execute(context.db);
            await createTable("TYPE_MAPPING_ASSM", assmColumns, tablespace).execute(context.db);

            const db = new Kysely<any>({
                dialect: new OracleDialect({
                    pool: context.getPool(),
                    introspectorOptions: {
                        schemas: [context.testId],
                        tables: ["TYPE_MAPPING", "TYPE_MAPPING_LONG", "TYPE_MAPPING_LONG_RAW", "TYPE_MAPPING_ASSM"],
                        type: "tables",
                    },
                }),
            });

            const tables = await db.introspection.getTables();

            const dataTypes = Object.fromEntries(
                tables.flatMap((table) => table.columns.map((column) => [column.name, column.dataType])),
            );

            const types = Object.fromEntries(
                [...generateTypes(tables).matchAll(/^ {4}(C_\w+): (.+);$/gm)].map(([, column, type]) => [column, type]),
            );

            expect(dataTypes).toEqual(
                Object.fromEntries(Object.entries(allColumns).map(([column, { dataType }]) => [column, dataType])),
            );

            expect(types).toEqual(
                Object.fromEntries(Object.entries(allColumns).map(([column, { type }]) => [column, type])),
            );
        } finally {
            await dropTablespace();
        }
    });
});
