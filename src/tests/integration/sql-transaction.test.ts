import { describe, expect, it } from "vitest";

describe("transaction", () => {
    it("should commit when the transaction is succesful", async (context) => {
        await context.db.transaction().execute(async (trx) => {
            await trx.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();
        });

        const items = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).execute();

        expect(items).toEqual([{ ID: 1, NAME: "Item1" }]);
    });

    it("should rollback when the transaction fails", async (context) => {
        await expect(
            context.db.transaction().execute(async (trx) => {
                await trx.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();
                throw new Error("Rollback transaction");
            }),
        ).rejects.toThrow("Rollback transaction");

        const items = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).execute();

        expect(items).toEqual([]);
    });

    it("should rollback to a created savepoint", async (context) => {
        const trx = await context.db.startTransaction().execute();

        try {
            await trx.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();

            const trxAfterSavepoint = await trx.savepoint("first_item").execute();

            await trxAfterSavepoint.insertInto("ITEMS").values({ NAME: "Item2" }).executeTakeFirst();
            await trxAfterSavepoint.rollbackToSavepoint("first_item").execute();

            await trx.commit().execute();
        } catch (error) {
            await trx.rollback().execute();
            throw error;
        }

        const items = await context.db.selectFrom("ITEMS").select(["ID", "NAME"]).execute();

        expect(items).toEqual([{ ID: 1, NAME: "Item1" }]);
    });
});
