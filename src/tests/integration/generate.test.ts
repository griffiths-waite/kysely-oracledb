import fs from "fs";
import { sql } from "kysely";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, TestContext } from "vitest";
import { OracleDialectConfig } from "../../dialect/dialect";
import { generate } from "../../generator/generate";

describe("generate", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(process.cwd(), "tmp"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const createConfig = (
        context: TestContext,
        config: Partial<OracleDialectConfig["generator"]> = {},
    ): OracleDialectConfig => {
        return {
            pool: context.getPool(),
            generator: {
                schemas: [context.testId],
                type: "tables",
                filePath: path.join(tmpDir, "types.ts"),
                metadataFilePath: path.join(tmpDir, "tables.json"),
                ...config,
            },
        };
    };

    const removeTimestamp = (content: string): string => {
        return content.replace(/Timestamp: .+/, "Timestamp: <TIMESTAMP>");
    };

    it("should generate a types file in snake_case by default", async (context) => {
        await generate(createConfig(context));

        const content = fs.readFileSync(path.join(tmpDir, "types.ts"), "utf8");

        expect(removeTimestamp(content)).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // Timestamp: <TIMESTAMP>

          import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

          interface DualTable {
              DUMMY: string | null;
          }
          export type Dual = Selectable<DualTable>;
          export type NewDual = Insertable<DualTable>;
          export type DualUpdate = Updateable<DualTable>;

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
              CODE: string;
              AMOUNT: number | null;
              NOTES: string | null;
              CREATED_AT: Date;
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
              'SYS.DUAL': DualTable;
              ITEM_TAGS: ItemTagsTable;
              ITEMS: ItemsTable;
              TAGS: TagsTable;
          }
          "
        `);
    });

    it("should generate a types file in camelCase when option enabled", async (context) => {
        await generate(createConfig(context, { camelCase: true }));

        const content = fs.readFileSync(path.join(tmpDir, "types.ts"), "utf8");

        expect(removeTimestamp(content)).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // Timestamp: <TIMESTAMP>

          import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

          interface DualTable {
              dummy: string | null;
          }
          export type Dual = Selectable<DualTable>;
          export type NewDual = Insertable<DualTable>;
          export type DualUpdate = Updateable<DualTable>;

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
              code: string;
              amount: number | null;
              notes: string | null;
              createdAt: Date;
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
              'sys.dual': DualTable;
              itemTags: ItemTagsTable;
              items: ItemsTable;
              tags: TagsTable;
          }
          "
        `);
    });

    it("should not retain underscores before leading digits by default", async (context) => {
        await context.db.schema.alterTable("ITEMS").addColumn("WITHOUT_1UNDERSCORE", "char(2)").execute();

        await generate(
            createConfig(context, {
                schemas: [context.testId],
                type: "tables",
                tables: ["ITEMS"],
                camelCase: true,
            }),
        );

        const content = fs.readFileSync(path.join(tmpDir, "types.ts"), "utf8");

        expect(removeTimestamp(content)).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // Timestamp: <TIMESTAMP>

          import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

          interface DualTable {
              dummy: string | null;
          }
          export type Dual = Selectable<DualTable>;
          export type NewDual = Insertable<DualTable>;
          export type DualUpdate = Updateable<DualTable>;

          interface ItemsTable {
              id: Generated<number>;
              name: string;
              code: string;
              amount: number | null;
              notes: string | null;
              createdAt: Date;
              updatedAt: Date | null;
              without1underscore: string | null;
          }
          export type Items = Selectable<ItemsTable>;
          export type NewItems = Insertable<ItemsTable>;
          export type ItemsUpdate = Updateable<ItemsTable>;

          export interface DB {
              'sys.dual': DualTable;
              items: ItemsTable;
          }
          "
        `);
    });

    it("should retain underscores before leading digits when option enabled", async (context) => {
        await context.db.schema.alterTable("ITEMS").addColumn("WITH_1UNDERSCORE", "char(2)").execute();

        await generate(
            createConfig(context, {
                schemas: [context.testId],
                type: "tables",
                tables: ["ITEMS"],
                camelCase: true,
                underscoreLeadingDigits: true,
            }),
        );

        const content = fs.readFileSync(path.join(tmpDir, "types.ts"), "utf8");

        expect(removeTimestamp(content)).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // Timestamp: <TIMESTAMP>

          import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

          interface DualTable {
              dummy: string | null;
          }
          export type Dual = Selectable<DualTable>;
          export type NewDual = Insertable<DualTable>;
          export type DualUpdate = Updateable<DualTable>;

          interface ItemsTable {
              id: Generated<number>;
              name: string;
              code: string;
              amount: number | null;
              notes: string | null;
              createdAt: Date;
              updatedAt: Date | null;
              with_1underscore: string | null;
          }
          export type Items = Selectable<ItemsTable>;
          export type NewItems = Insertable<ItemsTable>;
          export type ItemsUpdate = Updateable<ItemsTable>;

          export interface DB {
              'sys.dual': DualTable;
              items: ItemsTable;
          }
          "
        `);
    });

    it("should generate interval columns when feature is supported", async (context) => {
        await context.db.schema
            .alterTable("ITEMS")
            .addColumn("SUBSCRIPTION_LENGTH", sql`interval year(2) to month`)
            .execute();

        await context.db.schema
            .alterTable("ITEMS")
            .addColumn("SESSION_DURATION", sql`interval day(2) to second(6)`)
            .execute();

        await generate(
            createConfig(context, {
                schemas: [context.testId],
                type: "tables",
                tables: ["ITEMS"],
            }),
        );

        const content = fs.readFileSync(path.join(tmpDir, "types.ts"), "utf8");

        expect(removeTimestamp(content)).toMatchInlineSnapshot(`
          "// This file was generated automatically. Please don't edit it manually!
          // Timestamp: <TIMESTAMP>

          import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

          interface DualTable {
              DUMMY: string | null;
          }
          export type Dual = Selectable<DualTable>;
          export type NewDual = Insertable<DualTable>;
          export type DualUpdate = Updateable<DualTable>;

          interface ItemsTable {
              ID: Generated<number>;
              NAME: string;
              CODE: string;
              AMOUNT: number | null;
              NOTES: string | null;
              CREATED_AT: Date;
              UPDATED_AT: Date | null;
              SUBSCRIPTION_LENGTH: unknown | null;
              SESSION_DURATION: unknown | null;
          }
          export type Items = Selectable<ItemsTable>;
          export type NewItems = Insertable<ItemsTable>;
          export type ItemsUpdate = Updateable<ItemsTable>;

          export interface DB {
              'SYS.DUAL': DualTable;
              ITEMS: ItemsTable;
          }
          "
        `);
    });

    it("should not generate a metadata file by default", async (context) => {
        await generate(createConfig(context));

        expect(fs.existsSync(path.join(tmpDir, "tables.json"))).toBe(false);
    });

    it("should generate a metadata file when option enabled", async (context) => {
        await generate(createConfig(context, { metadata: true }));

        const metadataPath = path.join(tmpDir, "tables.json");

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
