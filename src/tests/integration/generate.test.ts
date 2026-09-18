import fs from "fs";
import { sql } from "kysely";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, TestContext, vi } from "vitest";
import { defaultLogger } from "../../dialect/logger";
import { generate, GeneratorConfig } from "../../generator/generate";

describe("generate", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(process.cwd(), "tmp"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const createConfig = (context: TestContext, config: Partial<GeneratorConfig> = {}): GeneratorConfig => {
        return {
            pool: config.pool ?? context.getPool(),
            introspectorOptions: { schemas: [context.testId], type: "tables" },
            filePath: `${tmpDir}/types.ts`,
            metadataFilePath: `${tmpDir}/tables.json`,
            ...config,
        };
    };

    describe("types", () => {
        it("should generate a types file in snake_case by default", async (context) => {
            await generate(createConfig(context));

            const content = fs.readFileSync(`${tmpDir}/types.ts`, "utf8");

            expect(content).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // kysely-oracledb:497444b221ae7dc2

          import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

          interface ItemTagsTable {
              ITEM_ID: number;
              TAG_ID: number;
          }

          export type ItemTags = Selectable<ItemTagsTable>;
          export type NewItemTags = Insertable<ItemTagsTable>;
          export type ItemTagsUpdate = Updateable<ItemTagsTable>;

          interface ItemsTable {
              ID: Generated<number>;
              NAME: string;
              CODE: ColumnType<string, string | undefined, string>;
              AMOUNT: number | null;
              NOTES: string | null;
              CREATED_AT: ColumnType<Date, Date | undefined, Date>;
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
              ITEM_TAGS: ItemTagsTable;
              ITEMS: ItemsTable;
              TAGS: TagsTable;
          }
          "
        `);
        });

        it("should generate a types file in camelCase when option enabled", async (context) => {
            await generate(createConfig(context, { camelCase: true }));

            const content = fs.readFileSync(`${tmpDir}/types.ts`, "utf8");

            expect(content).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // kysely-oracledb:7db898637b28fd88

          import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

          interface ItemTagsTable {
              itemId: number;
              tagId: number;
          }

          export type ItemTags = Selectable<ItemTagsTable>;
          export type NewItemTags = Insertable<ItemTagsTable>;
          export type ItemTagsUpdate = Updateable<ItemTagsTable>;

          interface ItemsTable {
              id: Generated<number>;
              name: string;
              code: ColumnType<string, string | undefined, string>;
              amount: number | null;
              notes: string | null;
              createdAt: ColumnType<Date, Date | undefined, Date>;
              updatedAt: Date | null;
          }

          export type Items = Selectable<ItemsTable>;
          export type NewItems = Insertable<ItemsTable>;
          export type ItemsUpdate = Updateable<ItemsTable>;

          interface TagsTable {
              id: Generated<number>;
              name: string;
          }

          export type Tags = Selectable<TagsTable>;
          export type NewTags = Insertable<TagsTable>;
          export type TagsUpdate = Updateable<TagsTable>;

          export interface DB {
              itemTags: ItemTagsTable;
              items: ItemsTable;
              tags: TagsTable;
          }
          "
        `);
        });

        it("should use camelCase for column names with leading digits", async (context) => {
            await context.db.schema.alterTable("ITEMS").addColumn("LEADING_1DIGIT", "char(1)").execute();

            await generate(
                createConfig(context, {
                    introspectorOptions: { schemas: [context.testId], type: "tables", tables: ["ITEMS"] },
                    camelCase: true,
                }),
            );

            const content = fs.readFileSync(`${tmpDir}/types.ts`, "utf8");

            expect(content).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // kysely-oracledb:ffd57c6236645513

          import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

          interface ItemsTable {
              id: Generated<number>;
              name: string;
              code: ColumnType<string, string | undefined, string>;
              amount: number | null;
              notes: string | null;
              createdAt: ColumnType<Date, Date | undefined, Date>;
              updatedAt: Date | null;
              leading1digit: string | null;
          }

          export type Items = Selectable<ItemsTable>;
          export type NewItems = Insertable<ItemsTable>;
          export type ItemsUpdate = Updateable<ItemsTable>;

          export interface DB {
              items: ItemsTable;
          }
          "
        `);
        });

        it("should warn when columns are unsafe for camelCase conversion", async (context) => {
            await context.db.schema.alterTable("ITEMS").addColumn("LEADING_1DIGIT", "char(1)").execute();

            const warn = vi.fn();

            await generate(
                createConfig(context, {
                    introspectorOptions: { schemas: [context.testId], type: "tables", tables: ["ITEMS"] },
                    camelCase: true,
                    camelCaseOptions: { underscoreBeforeDigits: false },
                    logger: { ...defaultLogger, warn },
                }),
            );

            expect(warn).toHaveBeenCalledWith(expect.stringContaining("LEADING_1DIGIT (leading1digit)"));
        });

        it("should not warn when columns are safe for camelCase conversion", async (context) => {
            await context.db.schema.alterTable("ITEMS").addColumn("LEADING_1DIGIT", "char(1)").execute();

            const warn = vi.fn();

            await generate(
                createConfig(context, {
                    introspectorOptions: { schemas: [context.testId], type: "tables", tables: ["ITEMS"] },
                    camelCase: true,
                    camelCaseOptions: { underscoreBeforeDigits: true },
                    logger: { ...defaultLogger, warn },
                }),
            );

            expect(warn).not.toHaveBeenCalled();
        });

        it("should generate interval columns when feature is supported", async (context) => {
            await context.db.schema
                .alterTable("ITEMS")
                .addColumn("YEAR_MONTH_INTERVAL", sql`interval year(2) to month`)
                .execute();

            await context.db.schema
                .alterTable("ITEMS")
                .addColumn("DAY_SECOND_INTERVAL", sql`interval day(2) to second(6)`)
                .execute();

            await generate(
                createConfig(context, {
                    introspectorOptions: { schemas: [context.testId], type: "tables", tables: ["ITEMS"] },
                }),
            );

            const content = fs.readFileSync(`${tmpDir}/types.ts`, "utf8");

            expect(content).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // kysely-oracledb:869d5988192067fc

          import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";
          import type { IntervalDS, IntervalYM } from "oracledb";

          interface ItemsTable {
              ID: Generated<number>;
              NAME: string;
              CODE: ColumnType<string, string | undefined, string>;
              AMOUNT: number | null;
              NOTES: string | null;
              CREATED_AT: ColumnType<Date, Date | undefined, Date>;
              UPDATED_AT: Date | null;
              YEAR_MONTH_INTERVAL: IntervalYM | null;
              DAY_SECOND_INTERVAL: IntervalDS | null;
          }

          export type Items = Selectable<ItemsTable>;
          export type NewItems = Insertable<ItemsTable>;
          export type ItemsUpdate = Updateable<ItemsTable>;

          export interface DB {
              ITEMS: ItemsTable;
          }
          "
        `);
        });
    });

    describe("metadata", () => {
        it("should not generate a metadata file by default", async (context) => {
            await generate(createConfig(context));

            expect(fs.existsSync(`${tmpDir}/tables.json`)).toBe(false);
        });

        it("should generate a metadata file when option enabled", async (context) => {
            await generate(createConfig(context, { metadata: true }));

            const metadataPath = `${tmpDir}/tables.json`;

            expect(fs.existsSync(metadataPath)).toBe(true);

            const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

            expect(metadata).toEqual(
                expect.arrayContaining([
                    {
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
                        isForeign: false,
                        isView: false,
                        name: "ITEMS",
                        schema: context.testId,
                    },
                ]),
            );
        });
    });

    describe("file path", () => {
        it("should create missing directories for the types file", async (context) => {
            const filePath = path.join(tmpDir, "nested", "database", "types.d.ts");

            await generate(createConfig(context, { filePath }));

            expect(fs.readFileSync(filePath, "utf8")).toContain("interface ItemsTable {");
        });

        it("should create missing directories for the metadata file", async (context) => {
            const metadataFilePath = `${tmpDir}/nested/metadata/tables.json`;

            await generate(createConfig(context, { metadata: true, metadataFilePath }));

            expect(fs.existsSync(metadataFilePath)).toBe(true);
        });

        it("should resolve a relative file path against the working directory", async (context) => {
            const relative = path.relative(process.cwd(), `${tmpDir}/relative/types.ts`);

            expect(path.isAbsolute(relative)).toBe(false);

            await generate(createConfig(context, { filePath: relative }));

            expect(fs.readFileSync(path.resolve(relative), "utf8")).toContain("interface ItemsTable {");
        });
    });

    describe("changed flag", () => {
        it("should flag types as changed for initial generation", async (context) => {
            const result = await generate(createConfig(context));

            expect(result.changed).toBe(true);
            expect(fs.existsSync(`${tmpDir}/types.ts`)).toBe(true);
        });

        it("should flag types as unchanged when no changes are detected", async (context) => {
            await generate(createConfig(context, { pool: await context.createPool() }));

            const before = fs.statSync(`${tmpDir}/types.ts`).mtimeMs;

            const result = await generate(createConfig(context, { pool: await context.createPool() }));

            expect(result.changed).toBe(false);
            expect(fs.statSync(`${tmpDir}/types.ts`).mtimeMs).toBe(before);
        });

        it("should flag types as changed when a column is added", async (context) => {
            await generate(createConfig(context, { pool: await context.createPool() }));

            await context.db.schema
                .alterTable("ITEMS")
                .addColumn("EXTRA", sql`varchar2(10)`)
                .execute();

            const result = await generate(createConfig(context, { pool: await context.createPool() }));

            expect(result.changed).toBe(true);
            expect(fs.readFileSync(`${tmpDir}/types.ts`, "utf8")).toContain("EXTRA: string | null;");
        });

        it("should flag types as unchanged but update metadata when a column is updated", async (context) => {
            await generate(createConfig(context, { pool: await context.createPool(), metadata: true }));

            const before = fs.readFileSync(`${tmpDir}/types.ts`, "utf8");

            await context.db.schema
                .alterTable("ITEMS")
                .modifyColumn("NAME", sql`varchar2(500)`)
                .execute();

            const result = await generate(createConfig(context, { pool: await context.createPool(), metadata: true }));

            expect(result.changed).toBe(false);
            expect(fs.readFileSync(`${tmpDir}/types.ts`, "utf8")).toEqual(before);
            expect(fs.readFileSync(`${tmpDir}/tables.json`, "utf8")).toContain('"dataLength": 500');
        });
    });
});
