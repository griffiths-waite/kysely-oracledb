import { sql } from "kysely";
import { describe, expect, it } from "vitest";

describe("alter", () => {
    it("should add a column", async (context) => {
        await context.db.schema
            .alterTable("ITEMS")
            .addColumn("STOCK", sql`number`, (col) => col.notNull().defaultTo(0))
            .execute();

        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).execute();

        const itemStock = await context.db
            .selectFrom("ITEMS")
            .select("STOCK" as any)
            .executeTakeFirst();

        expect(itemStock).toEqual({ STOCK: 0 });
    });

    it("should modify a column", async (context) => {
        await context.db.schema
            .alterTable("ITEMS")
            .modifyColumn("NAME", sql`varchar2(500)`)
            .execute();

        const longName = "A".repeat(300);

        await context.db.insertInto("ITEMS").values({ NAME: longName }).execute();

        const itemName = await context.db.selectFrom("ITEMS").select("NAME").executeTakeFirst();

        expect(itemName).toEqual({ NAME: longName });
    });

    it("should alter a column", async (context) => {
        await context.db.schema
            .alterTable("ITEMS")
            .alterColumn("NAME", (col) => col.dropNotNull())
            .execute();

        await context.db
            .insertInto("ITEMS")
            .values({ AMOUNT: 1 } as any)
            .execute();

        const itemName = await context.db.selectFrom("ITEMS").select("NAME").executeTakeFirst();

        expect(itemName).toEqual({ NAME: null });
    });

    it("should drop a column", async (context) => {
        await context.db.schema.alterTable("ITEMS").dropColumn("NOTES").execute();

        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).execute();

        const item = await context.db.selectFrom("ITEMS").selectAll().executeTakeFirst();

        expect(item).not.toHaveProperty("NOTES");
    });

    it("should drop a constraint", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();
        await context.db.insertInto("TAGS").values({ NAME: "Tag1" }).executeTakeFirst();

        await context.db.insertInto("ITEM_TAGS").values({ ITEM_ID: 1, TAG_ID: 1 }).executeTakeFirst();

        await context.db.schema.alterTable("ITEM_TAGS").dropConstraint("ITEM_TAGS_PK").execute();

        await context.db.insertInto("ITEM_TAGS").values({ ITEM_ID: 1, TAG_ID: 1 }).executeTakeFirst();

        const itemTags = await context.db.selectFrom("ITEM_TAGS").selectAll().execute();

        expect(itemTags).toHaveLength(2);
    });
});
