import { describe, expect, it } from "vitest";

describe("delete", () => {
    it("should delete a single row", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();

        const result = await context.db.deleteFrom("ITEMS").where("NAME", "=", "Item1").executeTakeFirst();

        const items = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).execute();

        expect(result.numDeletedRows).toBe(1n);
        expect(items).toEqual([]);
    });

    it("should only delete matching rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }])
            .executeTakeFirst();

        const result = await context.db.deleteFrom("ITEMS").where("NAME", "=", "Item1").executeTakeFirst();

        const items = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).execute();

        expect(result.numDeletedRows).toBe(1n);
        expect(items).toEqual([{ ID: 2, NAME: "Item2" }]);
    });
});
