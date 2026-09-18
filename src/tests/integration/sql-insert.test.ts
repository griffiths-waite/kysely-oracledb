import { Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import { OracleDialect } from "../../dialect/dialect";
import { withExecuteOptions } from "../../plugins/with-execute-options";
import { DB } from "./fixtures/types-snake-case";

describe("insert", () => {
    it("should insert a single row", async (context) => {
        const result = await context.db.insertInto("ITEMS").values({ NAME: "Item1" }).executeTakeFirst();

        expect(result.numInsertedOrUpdatedRows).toBe(1n);
    });

    it("should insert multiple rows", async (context) => {
        const result = await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }])
            .executeTakeFirst();

        expect(result.numInsertedOrUpdatedRows).toBe(2n);
    });

    it("should set correct values for string columns with defaults", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1", CODE: "B" }, { NAME: "Item2" }])
            .executeTakeFirst();

        const items = await context.db.selectFrom("ITEMS").select(["ID", "NAME", "CODE"]).execute();

        expect(items).toEqual([
            { ID: 1, NAME: "Item1", CODE: "B" },
            { ID: 2, NAME: "Item2", CODE: "A" },
        ]);
    });

    it("should set correct values for date columns with defaults", async (context) => {
        const currentDate = new Date();
        currentDate.setMilliseconds(0);

        await context.db
            .insertInto("ITEMS")
            .values([
                { NAME: "Item1" },
                {
                    NAME: "Item2",
                    CREATED_AT: new Date(currentDate.getTime() - 1000 * 60 * 60),
                    UPDATED_AT: currentDate,
                },
            ])
            .executeTakeFirst();

        const items = await context.db.selectFrom("ITEMS").select(["ID", "CREATED_AT", "UPDATED_AT"]).execute();

        expect(items).toEqual([
            {
                ID: 1,
                CREATED_AT: currentDate,
                UPDATED_AT: null,
            },
            {
                ID: 2,
                CREATED_AT: new Date(currentDate.getTime() - 1000 * 60 * 60),
                UPDATED_AT: currentDate,
            },
        ]);
    });

    it("should include execute options when passed via plugin", async (context) => {
        const db = new Kysely<DB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
                executeOptions: {
                    autoCommit: false,
                },
            }),
        });

        const result = await db
            .insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .withPlugin(withExecuteOptions({ autoCommit: true }))
            .executeTakeFirst();

        expect(result.numInsertedOrUpdatedRows).toBe(1n);
    });
});
