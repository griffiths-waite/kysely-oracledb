import { describe, expect, it } from "vitest";

describe("update", () => {
    it("should update a single row", async (context) => {
        await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();

        const result = await context.db
            .updateTable("ITEMS")
            .set({ NAME: "UpdatedItem", CODE: "B" })
            .where("NAME", "=", "Item1")
            .executeTakeFirst();

        const item = await context.db.selectFrom("ITEMS").select(["ID", "NAME", "CODE"]).executeTakeFirst();

        expect(result.numUpdatedRows).toBe(1n);
        expect(item).toEqual({ ID: 1, NAME: "UpdatedItem", CODE: "B" });
    });

    it("should only update matching rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }])
            .executeTakeFirst();

        const result = await context.db
            .updateTable("ITEMS")
            .set({ CODE: "B" })
            .where("NAME", "=", "Item2")
            .executeTakeFirst();

        const items = await context.db.selectFrom("ITEMS").select(["ID", "NAME", "CODE"]).orderBy("ID").execute();

        expect(result.numUpdatedRows).toBe(1n);
        expect(items).toEqual([
            { ID: 1, NAME: "Item1", CODE: "A" },
            { ID: 2, NAME: "Item2", CODE: "B" },
        ]);
    });
});
