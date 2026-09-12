import { CamelCasePlugin, Kysely, ParseJSONResultsPlugin } from "kysely";
import { describe, expect, it } from "vitest";
import { OracleDialect } from "../../dialect/dialect";
import { DB as CamelCaseDB } from "./fixtures/types-camel-case";
import { DB } from "./fixtures/types-snake-case";

describe("select", () => {
    it("should select a single row", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();

        const row = await context.db.selectFrom("ITEMS").select(["ID", "NAME", "CODE"]).executeTakeFirst();

        expect(row).toEqual({
            ID: 1,
            NAME: "Item1",
            CODE: "A",
        });
    });

    it("should select multiple rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }])
            .executeTakeFirst();

        const rows = await context.db.selectFrom("ITEMS").select(["ID", "NAME", "CODE"]).execute();

        expect(rows).toEqual([
            {
                ID: 1,
                NAME: "Item1",
                CODE: "A",
            },
            {
                ID: 2,
                NAME: "Item2",
                CODE: "A",
            },
        ]);
    });

    it("should return aliased select statement values", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();

        const row = await context.db
            .selectFrom("ITEMS")
            .select(["ID as id", "NAME as name", "CODE as code"])
            .executeTakeFirst();

        expect(row).toEqual({
            id: 1,
            name: "Item1",
            code: "A",
        });
    });

    it("should filter rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1", CODE: "B" }, { NAME: "Item2" }, { NAME: "Item3" }])
            .executeTakeFirst();

        const rows = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).where("CODE", "=", "A").execute();

        expect(rows).toEqual([
            { ID: 2, NAME: "Item2" },
            { ID: 3, NAME: "Item3" },
        ]);
    });

    it("should order rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }, { NAME: "Item3" }])
            .executeTakeFirst();

        const rows = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).orderBy("NAME", "desc").execute();

        expect(rows).toEqual([
            { ID: 3, NAME: "Item3" },
            { ID: 2, NAME: "Item2" },
            { ID: 1, NAME: "Item1" },
        ]);
    });

    it("should fetch first n rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }, { NAME: "Item3" }])
            .executeTakeFirst();

        const rows = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).fetch(1).execute();

        expect(rows).toEqual([{ ID: 1, NAME: "Item1" }]);
    });

    it("should offset rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }, { NAME: "Item3" }])
            .executeTakeFirst();

        const rows = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).offset(1).execute();

        expect(rows).toEqual([
            { ID: 2, NAME: "Item2" },
            { ID: 3, NAME: "Item3" },
        ]);
    });

    it("should fetch and offset rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }, { NAME: "Item3" }])
            .executeTakeFirst();

        const rows = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).fetch(1).offset(1).execute();

        expect(rows).toEqual([{ ID: 2, NAME: "Item2" }]);
    });

    it("should select rows from joined tables", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();
        await context.db
            .insertInto("TAGS")
            .values([{ NAME: "Tag1" }, { NAME: "Tag2" }])
            .executeTakeFirst();
        await context.db
            .insertInto("ITEM_TAGS")
            .values([
                { ITEM_ID: 1, TAG_ID: 1 },
                { ITEM_ID: 1, TAG_ID: 2 },
            ])
            .executeTakeFirst();

        const rows = await context.db
            .selectFrom("ITEMS as items")
            .innerJoin("ITEM_TAGS as item_tags", "item_tags.ITEM_ID", "items.ID")
            .innerJoin("TAGS as tags", "tags.ID", "item_tags.TAG_ID")
            .select(["items.NAME as itemName", "tags.NAME as tagName"])
            .where("items.CODE", "=", "A")
            .orderBy("tags.NAME", "desc")
            .execute();

        expect(rows).toEqual([
            { itemName: "Item1", tagName: "Tag2" },
            { itemName: "Item1", tagName: "Tag1" },
        ]);
    });

    it("should return CLOB columns as strings", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "Item1", NOTES: "This is a note." }).executeTakeFirst();

        const row = await context.db.selectFrom("ITEMS").select(["ID", "NAME", "NOTES"]).executeTakeFirst();

        expect(row).toEqual({
            ID: 1,
            NAME: "Item1",
            NOTES: "This is a note.",
        });
    });

    it("should format JSON columns with the parse JSON results plugin", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values({ NAME: "Item1", NOTES: JSON.stringify({ text: "This is a JSON note." }) })
            .executeTakeFirst();

        const row = await context.db
            .selectFrom("ITEMS")
            .select(["ID", "NAME", "NOTES"])
            .withPlugin(new ParseJSONResultsPlugin())
            .executeTakeFirst();

        expect(row).toEqual({
            ID: 1,
            NAME: "Item1",
            NOTES: { text: "This is a JSON note." },
        });
    });

    it("should format query with the camel case plugin", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "TestItem" }).executeTakeFirst();

        const db = new Kysely<CamelCaseDB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
            }),
            plugins: [new CamelCasePlugin({ upperCase: true })],
        });

        const row = await db
            .selectFrom("items")
            .select(["id", "name", "code"])
            .where("name", "=", "TestItem")
            .where("code", "=", "A")
            .executeTakeFirst();

        expect(row).toEqual({
            id: 1,
            name: "TestItem",
            code: "A",
        });
    });

    it("should format query with non-quoted identifiers", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "TestItem" }).executeTakeFirst();

        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                compilerOptions: {
                    useNonQuotedIdentifiers: true,
                },
            }),
        });

        const row = await db
            .selectFrom("ITEMS")
            .select(["ID as id", "NAME as name", "CODE as code"])
            .where("NAME", "=", "TestItem")
            .where("CODE", "=", "A")
            .executeTakeFirst();

        expect(row).toEqual({
            id: 1,
            name: "TestItem",
            code: "A",
        });
    });
});
