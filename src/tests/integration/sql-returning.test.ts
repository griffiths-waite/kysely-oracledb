import { CamelCasePlugin, Kysely, sql } from "kysely";
import oracledb from "oracledb";
import { describe, expect, it } from "vitest";
import { OracleDialect } from "../../dialect/dialect";
import { withReturning } from "../../plugins/with-returning";
import { DB as CamelCaseDB } from "./fixtures/types-camel-case";

describe("returning", () => {
    it("should return columns from an insert", async (context) => {
        const item = await context.db
            .insertInto("ITEMS")
            .values({ NAME: "Item1", AMOUNT: 1.5 })
            .returning(["ID", "NAME", "AMOUNT", "CREATED_AT"])
            .$call(
                withReturning({
                    ID: oracledb.NUMBER,
                    NAME: { type: oracledb.STRING, maxSize: 255 },
                    AMOUNT: oracledb.NUMBER,
                    CREATED_AT: oracledb.DATE,
                }),
            )
            .executeTakeFirstOrThrow();

        expect(item).toEqual({ ID: 1, NAME: "Item1", AMOUNT: 1.5, CREATED_AT: expect.any(Date) });
    });

    it("should return aliased columns and expressions", async (context) => {
        const item = await context.db
            .insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .returning(["ID as itemId", sql<string>`lower(NAME)`.as("lowerName")])
            .$call(withReturning({ itemId: oracledb.NUMBER, lowerName: oracledb.STRING }))
            .executeTakeFirstOrThrow();

        expect(item).toEqual({ itemId: 1, lowerName: "item1" });
    });

    it("should return clob columns as strings when fetched as strings", async (context) => {
        const notes = "x".repeat(10_000);

        const item = await context.db
            .insertInto("ITEMS")
            .values({ NAME: "Item1", NOTES: notes })
            .returning(["NOTES"])
            .$call(withReturning({ NOTES: oracledb.CLOB }))
            .executeTakeFirstOrThrow();

        expect(item).toEqual({ NOTES: notes });
    });

    it("should return clob columns as lobs when not fetched as strings", async (context) => {
        const fetchAsString = oracledb.fetchAsString;
        oracledb.fetchAsString = [];

        try {
            const item = await context.db
                .insertInto("ITEMS")
                .values({ NAME: "Item1", NOTES: "Notes" })
                .returning(["NOTES"])
                .$call(withReturning({ NOTES: oracledb.CLOB }))
                .executeTakeFirstOrThrow();

            const lob = item.NOTES as unknown as oracledb.Lob;

            expect(lob).toBeInstanceOf(oracledb.Lob);
            expect(await lob.getData()).toBe("Notes");
        } finally {
            oracledb.fetchAsString = fetchAsString;
        }
    });

    it("should return blob columns as buffers when fetched as buffers", async (context) => {
        const fetchAsBuffer = oracledb.fetchAsBuffer;
        oracledb.fetchAsBuffer = [oracledb.BLOB];

        try {
            await sql`create table FILES (ID number generated always as identity, DATA blob)`.execute(context.db);

            const data = Buffer.alloc(10_000, 1);

            const file = await (context.db as Kysely<any>)
                .insertInto("FILES")
                .values({ DATA: data })
                .returning(["DATA"])
                .$call(withReturning({ DATA: oracledb.BLOB }))
                .executeTakeFirstOrThrow();

            expect(file).toEqual({ DATA: data });
        } finally {
            oracledb.fetchAsBuffer = fetchAsBuffer;
        }
    });

    it("should return every updated row", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }, { NAME: "Item3" }])
            .execute();

        const items = await context.db
            .updateTable("ITEMS")
            .set({ CODE: "B" })
            .where("ID", "<", 3)
            .returning(["ID", "CODE"])
            .$call(withReturning({ ID: oracledb.NUMBER, CODE: oracledb.STRING }))
            .execute();

        expect(items).toEqual([
            { ID: 1, CODE: "B" },
            { ID: 2, CODE: "B" },
        ]);
    });

    it("should return no rows when nothing is updated", async (context) => {
        const items = await context.db
            .updateTable("ITEMS")
            .set({ CODE: "B" })
            .returning(["ID"])
            .$call(withReturning({ ID: oracledb.NUMBER }))
            .execute();

        expect(items).toEqual([]);
    });

    it("should return deleted rows", async (context) => {
        await context.db
            .insertInto("ITEMS")
            .values([{ NAME: "Item1" }, { NAME: "Item2" }])
            .execute();

        const items = await context.db
            .deleteFrom("ITEMS")
            .where("NAME", "=", "Item2")
            .returning(["ID", "NAME"])
            .$call(withReturning({ ID: oracledb.NUMBER, NAME: oracledb.STRING }))
            .execute();

        expect(items).toEqual([{ ID: 2, NAME: "Item2" }]);
    });

    it("should throw when returning from a multi-row insert", async (context) => {
        await expect(
            context.db
                .insertInto("ITEMS")
                .values([{ NAME: "Item1" }, { NAME: "Item2" }])
                .returning(["ID"])
                .$call(withReturning({ ID: oracledb.NUMBER }))
                .execute(),
        ).rejects.toThrow("Insert with `returning` only supports a single row of values in Oracle.");
    });

    it("should throw when returning from an insert select", async (context) => {
        await expect(
            context.db
                .insertInto("ITEMS")
                .columns(["NAME"])
                .expression((eb) => eb.selectFrom("TAGS").select("NAME"))
                .returning(["ID"])
                .$call(withReturning({ ID: oracledb.NUMBER }))
                .execute(),
        ).rejects.toThrow("Insert with `returning` only supports a single row of values in Oracle.");
    });

    it("should return columns inside a transaction", async (context) => {
        const item = await context.db.transaction().execute(async (trx) => {
            return trx
                .insertInto("ITEMS")
                .values({ NAME: "Item1" })
                .returning(["ID"])
                .$call(withReturning({ ID: oracledb.NUMBER }))
                .executeTakeFirstOrThrow();
        });

        expect(item).toEqual({ ID: 1 });
    });

    it("should return camel case columns", async (context) => {
        const db = new Kysely<CamelCaseDB>({
            dialect: new OracleDialect({
                pool: context.getPool(),
            }),
            plugins: [new CamelCasePlugin({ upperCase: true })],
        });

        const item = await db
            .insertInto("items")
            .values({ name: "Item1" })
            .returning(["id", "createdAt", "name as itemName"])
            .$call(withReturning({ id: oracledb.NUMBER, createdAt: oracledb.DATE, itemName: oracledb.STRING }))
            .executeTakeFirstOrThrow();

        expect(item).toEqual({ id: 1, createdAt: expect.any(Date), itemName: "Item1" });
    });

    it("should throw when a returning column has no bind type", async (context) => {
        await expect(
            context.db
                .insertInto("ITEMS")
                .values({ NAME: "Item1" })
                .returning(["ID", "NAME"])
                // Bind keys are type checked, so this needs a cast.
                .$call(withReturning({ ID: oracledb.NUMBER } as any))
                .execute(),
        ).rejects.toThrow('Missing bind type for returning column "NAME"');
    });

    it("should throw when returning all columns", async (context) => {
        await expect(context.db.insertInto("ITEMS").values({ NAME: "Item1" }).returningAll().execute()).rejects.toThrow(
            "Returning all columns is not supported by Oracle.",
        );
    });
});
