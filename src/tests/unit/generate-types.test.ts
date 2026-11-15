import { ColumnMetadata } from "kysely";
import { describe, expect, it } from "vitest";
import { generateTypes } from "../../generator/generate";
import { readFingerprint } from "../../generator/render";
import { column, table } from "./fixtures/metadata";

const withColumns = (...columns: ColumnMetadata[]) => [table("ITEMS", columns)];

describe("generateTypes", () => {
    describe("data types", () => {
        it.each([
            ["BFILE", "string"],
            ["BINARY_DOUBLE", "number"],
            ["BINARY_FLOAT", "number"],
            ["BINARY_INTEGER", "number"],
            ["BLOB", "string"],
            ["PL/SQL BOOLEAN", "boolean"],
            ["CHAR", "string"],
            ["CLOB", "string"],
            ["SYS_REFCURSOR", "string"],
            ["DATE", "Date"],
            ["FLOAT", "number"],
            ["JSON", "string"],
            ["LONG", "string"],
            ["LONG RAW", "string"],
            ["NCHAR", "string"],
            ["NCLOB", "string"],
            ["NUMBER", "number"],
            ["NVARCHAR2", "string"],
            ["OBJECT", "string"],
            ["RAW", "string"],
            ["ROWID", "string"],
            ["TIMESTAMP", "Date"],
            ["VARCHAR2", "string"],
            ["XMLTYPE", "string"],
            ["VECTOR", "string"],
        ])("should map %s to %s", (dataType, expected) => {
            const types = generateTypes(withColumns(column("COL", dataType)));

            expect(types).toContain(`COL: ${expected};`);
        });

        it.each(["TIMESTAMP(6)", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP(6) WITH LOCAL TIME ZONE"])(
            "should map %s to Date",
            (dataType) => {
                expect(generateTypes(withColumns(column("COL", dataType)))).toContain("COL: Date;");
            },
        );

        it("should map interval year types to IntervalYM", () => {
            const types = generateTypes(withColumns(column("COL", "INTERVAL YEAR(2) TO MONTH")));

            expect(types).toContain("COL: IntervalYM;");
            expect(types).toContain('import type { IntervalYM } from "oracledb";');
        });

        it("should map interval day types to IntervalDS", () => {
            const types = generateTypes(withColumns(column("COL", "INTERVAL DAY(2) TO SECOND(6)")));

            expect(types).toContain("COL: IntervalDS;");
            expect(types).toContain('import type { IntervalDS } from "oracledb";');
        });

        it("should map unrecognised data types to unknown", () => {
            expect(generateTypes(withColumns(column("COL", "SOMETHING_WEIRD")))).toContain("COL: unknown;");
        });
    });

    describe("column modifiers", () => {
        it("should render a standard column as the mapped type", () => {
            expect(generateTypes(withColumns(column("COL", "NUMBER")))).toContain("COL: number;");
        });

        it("should union a nullable column with null", () => {
            const types = generateTypes(withColumns(column("COL", "NUMBER", { isNullable: true })));

            expect(types).toContain("COL: number | null;");
        });

        it("should wrap an auto incrementing column in Generated", () => {
            const types = generateTypes(withColumns(column("COL", "NUMBER", { isAutoIncrementing: true })));

            expect(types).toContain("COL: Generated<number>;");
        });

        it("should wrap a defaulted column in ColumnType", () => {
            const types = generateTypes(withColumns(column("COL", "DATE", { hasDefaultValue: true })));

            expect(types).toContain("COL: ColumnType<Date, Date | undefined, Date>;");
        });

        it("should prefer Generated over ColumnType for identity columns", () => {
            const types = generateTypes(
                withColumns(column("COL", "NUMBER", { isAutoIncrementing: true, hasDefaultValue: true })),
            );

            expect(types).toContain("COL: Generated<number>;");
            expect(types).not.toContain("ColumnType");
        });

        it("should wrap a nullable auto incrementing column in a single Generated type argument", () => {
            const types = generateTypes(
                withColumns(column("COL", "NUMBER", { isAutoIncrementing: true, isNullable: true })),
            );

            expect(types).toContain("COL: Generated<number | null>;");
        });

        it("should wrap a nullable defaulted column in a valid ColumnType", () => {
            const types = generateTypes(
                withColumns(column("COL", "DATE", { hasDefaultValue: true, isNullable: true })),
            );

            expect(types).toContain("COL: ColumnType<Date | null, Date | null | undefined, Date | null>;");
        });
    });

    describe("naming", () => {
        const tables = [table("ITEM_TAGS", [column("ITEM_ID", "NUMBER")])];

        it("should retain database casing by default", () => {
            const types = generateTypes(tables);

            expect(types).toContain("ITEM_ID: number;");
            expect(types).toContain("ITEM_TAGS: ItemTagsTable;");
        });

        it("should camelize fields and database keys when enabled", () => {
            const types = generateTypes(tables, { camelCase: true });

            expect(types).toContain("itemId: number;");
            expect(types).toContain("itemTags: ItemTagsTable;");
        });

        it("should use pascal case type names regardless of the camelCase option", () => {
            expect(generateTypes(tables)).toContain("interface ItemTagsTable {");
            expect(generateTypes(tables, { camelCase: true })).toContain("interface ItemTagsTable {");
        });

        it("should use camelCase for column names with leading digits", () => {
            const types = generateTypes(withColumns(column("ISO_2CHAR_COUNTRY", "CHAR")), { camelCase: true });

            expect(types).toContain("iso2charCountry: string;");
        });

        it("should leave a quoted identifier untouched", () => {
            const types = generateTypes(withColumns(column("MyColumn", "CHAR")), { camelCase: true });

            expect(types).toContain("MyColumn: string;");
        });
    });

    describe("imports", () => {
        it("should only import the kysely helper types when nothing else is required", () => {
            const types = generateTypes(withColumns(column("COL", "NUMBER")));

            expect(types).toContain('import type { Insertable, Selectable, Updateable } from "kysely";');
            expect(types).not.toContain("Generated");
            expect(types).not.toContain('from "oracledb";');
        });

        it("should dedupe imports across tables and sort them alphabetically", () => {
            const types = generateTypes([
                table("A", [column("ID", "NUMBER", { isAutoIncrementing: true })]),
                table("B", [column("ID", "NUMBER", { isAutoIncrementing: true })]),
                table("C", [column("ID", "NUMBER", { hasDefaultValue: true })]),
            ]);

            expect(types.match(/^import /gm)).toHaveLength(1);
            expect(types).toContain(
                'import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";',
            );
        });

        it("should import from oracledb after kysely", () => {
            const types = generateTypes(withColumns(column("COL", "INTERVAL DAY(2) TO SECOND(6)")));

            expect(types.indexOf('from "kysely"')).toBeLessThan(types.indexOf('from "oracledb"'));
        });
    });

    describe("tables", () => {
        const tables = [
            table("ITEMS", [column("ID", "NUMBER")]),
            table("TAGS", [column("ID", "NUMBER")]),
            table("ITEM_TAGS", [column("ID", "NUMBER")]),
        ];

        it("should sort tables by name", () => {
            const types = generateTypes(tables);

            expect(types.indexOf("interface ItemTagsTable")).toBeLessThan(types.indexOf("interface ItemsTable"));
            expect(types.indexOf("interface ItemsTable")).toBeLessThan(types.indexOf("interface TagsTable"));
        });

        it("should order database entries to match the interfaces", () => {
            const entries = generateTypes(tables)
                .split("export interface DB {")[1]
                .split("}")[0]
                .trim()
                .split("\n")
                .map((entry) => entry.trim());

            expect(entries).toEqual(["ITEM_TAGS: ItemTagsTable;", "ITEMS: ItemsTable;", "TAGS: TagsTable;"]);
        });

        it("should handle a table with no columns", () => {
            expect(generateTypes([table("EMPTY", [])])).toContain("interface EmptyTable {\n}");
        });

        it("should handle no tables", () => {
            expect(generateTypes([])).toMatchInlineSnapshot(`
              "// This file was generated automatically. Please don't edit it manually!
              // kysely-oracledb:645d93f14f17c220

              export interface DB {
              }
              "
            `);
        });
    });

    describe("fingerprint", () => {
        const tables = [
            table("ITEMS", [
                column("ID", "NUMBER", { isAutoIncrementing: true }),
                column("NAME", "VARCHAR2"),
                column("CREATED_AT", "DATE", { hasDefaultValue: true }),
            ]),
        ];

        it("should include a fingerprint in the header", () => {
            expect(generateTypes(tables)).toMatch(/^\/\/ kysely-oracledb:[0-9a-f]{16}$/m);
        });

        it("should return the same fingerprint for the same tables", () => {
            expect(readFingerprint(generateTypes(tables))).toBe(readFingerprint(generateTypes(tables)));
        });

        it("should return a different fingerprint when a column changes", () => {
            const changed = [table("ITEMS", [...tables[0].columns, column("AMOUNT", "NUMBER")])];

            expect(readFingerprint(generateTypes(changed))).not.toBe(readFingerprint(generateTypes(tables)));
        });

        it("should return a different fingerprint when naming options change", () => {
            expect(readFingerprint(generateTypes(tables, { camelCase: true }))).not.toBe(
                readFingerprint(generateTypes(tables)),
            );
        });

        it("should return undefined when there is no fingerprint", () => {
            expect(readFingerprint("interface ItemsTable {}")).toBeUndefined();
            expect(readFingerprint(undefined)).toBeUndefined();
        });
    });

    it("should generate a complete types file", () => {
        const types = generateTypes([
            table("ITEMS", [
                column("ID", "NUMBER", { isAutoIncrementing: true, hasDefaultValue: true }),
                column("NAME", "VARCHAR2"),
                column("CODE", "CHAR", { hasDefaultValue: true }),
                column("UPDATED_AT", "DATE", { isNullable: true }),
            ]),
            table("TAGS", [
                column("ID", "NUMBER", { isAutoIncrementing: true, hasDefaultValue: true }),
                column("NAME", "VARCHAR2"),
            ]),
        ]);

        expect(types).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // kysely-oracledb:28f5a3a27c6edb93

          import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

          interface ItemsTable {
              ID: Generated<number>;
              NAME: string;
              CODE: ColumnType<string, string | undefined, string>;
              UPDATED_AT: Date | null;
          }

          export type Items = Selectable<ItemsTable>;
          export type NewItems = Insertable<ItemsTable>;
          export type ItemsUpdate = Updateable<ItemsTable>;

          interface TagsTable {
              ID: Generated<number>;
              NAME: string;
          }

          export type Tags = Selectable<TagsTable>;
          export type NewTags = Insertable<TagsTable>;
          export type TagsUpdate = Updateable<TagsTable>;

          export interface DB {
              ITEMS: ItemsTable;
              TAGS: TagsTable;
          }
          "
        `);
    });
});
