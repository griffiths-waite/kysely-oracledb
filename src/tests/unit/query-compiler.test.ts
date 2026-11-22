import { CamelCasePlugin, DummyDriver, Generated, Kysely, sql } from "kysely";
import oracledb from "oracledb";
import { describe, expect, expectTypeOf, it } from "vitest";
import { OracleAdapter } from "../../dialect/adapter";
import { OracleIntrospector } from "../../dialect/introspector";
import { CompilerOptions, OracleCompiledQuery, OracleQueryCompiler } from "../../dialect/query-compiler";
import { withReturning } from "../../plugins/with-returning";

interface DB {
    ITEMS: { ID: Generated<number>; NAME: string };
}

interface CamelCaseDB {
    items: { id: Generated<number>; itemName: string };
}

const createDb = (compilerOptions?: CompilerOptions) =>
    new Kysely<DB>({
        dialect: {
            createAdapter: () => new OracleAdapter(),
            createDriver: () => new DummyDriver(),
            createIntrospector: (db) => new OracleIntrospector(db),
            createQueryCompiler: () => new OracleQueryCompiler(compilerOptions),
        },
    });

const out = (type: unknown, maxSize?: number) => ({
    dir: oracledb.BIND_OUT,
    type,
    ...(maxSize !== undefined && { maxSize }),
});

describe("query compiler fetch", () => {
    const db = createDb();

    it("should compile fetch to rows only", () => {
        const query = db.selectFrom("ITEMS").selectAll().orderBy("ID").fetch(5).compile();

        expect(query.sql).toBe('select * from "ITEMS" order by "ID" fetch first :1 rows only');
        expect(query.parameters).toEqual([5]);
    });

    it("should compile fetch with ties", () => {
        const query = db.selectFrom("ITEMS").selectAll().orderBy("ID").fetch(5, "with ties").compile();

        expect(query.sql).toBe('select * from "ITEMS" order by "ID" fetch first :1 rows with ties');
        expect(query.parameters).toEqual([5]);
    });
});

describe("query compiler returning", () => {
    const db = createDb();

    it("should compile insert returning into out binds", () => {
        const query = db
            .insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .returning(["ID", "NAME"])
            .$call(withReturning({ ID: oracledb.NUMBER, NAME: { type: oracledb.STRING, maxSize: 100 } }))
            .compile() as OracleCompiledQuery;

        expect(query.sql).toBe('insert into "ITEMS" ("NAME") values (:1) returning "ID", "NAME" into :2, :3');
        expect(query.parameters).toEqual(["Item1", out(oracledb.NUMBER), out(oracledb.STRING, 100)]);
        expect(query.returningColumns).toEqual(["ID", "NAME"]);
    });

    it("should compile update and delete returning", () => {
        const update = db
            .updateTable("ITEMS")
            .set({ NAME: "Item2" })
            .where("ID", "=", 1)
            .returning("ID")
            .$call(withReturning({ ID: oracledb.NUMBER }))
            .compile();

        const remove = db
            .deleteFrom("ITEMS")
            .where("ID", "=", 1)
            .returning("ID")
            .$call(withReturning({ ID: oracledb.NUMBER }))
            .compile();

        expect(update.sql).toBe('update "ITEMS" set "NAME" = :1 where "ID" = :2 returning "ID" into :3');
        expect(update.parameters).toEqual(["Item2", 1, out(oracledb.NUMBER)]);
        expect(remove.sql).toBe('delete from "ITEMS" where "ID" = :1 returning "ID" into :2');
    });

    it("should leave aliases out of the returning clause", () => {
        const query = db
            .insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .returning(["ITEMS.ID as itemId", sql<string>`lower(NAME)`.as("lowerName")])
            .$call(withReturning({ itemId: oracledb.NUMBER, lowerName: oracledb.STRING }))
            .compile() as OracleCompiledQuery;

        expect(query.sql).toBe(
            'insert into "ITEMS" ("NAME") values (:1) returning "ITEMS"."ID", lower(NAME) into :2, :3',
        );
        expect(query.returningColumns).toEqual(["itemId", "lowerName"]);
    });

    it("should uppercase column names with non-quoted identifiers", () => {
        const query = createDb({ useNonQuotedIdentifiers: true })
            .insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .returning(sql<number>`ID`.as("id"))
            .returning("ITEMS.NAME")
            .$call(withReturning({ id: oracledb.NUMBER, NAME: oracledb.STRING }))
            .compile() as OracleCompiledQuery;

        expect(query.sql).toBe("insert into ITEMS (NAME) values (:1) returning ID, ITEMS.NAME into :2, :3");
        expect(query.returningColumns).toEqual(["id", "NAME"]);
    });

    it("should not set returning columns without a returning clause", () => {
        const query = db.insertInto("ITEMS").values({ NAME: "Item1" }).compile() as OracleCompiledQuery;

        expect(query.returningColumns).toBeUndefined();
    });

    it("should throw when a returning column has no bind type", () => {
        expect(() => db.insertInto("ITEMS").values({ NAME: "Item1" }).returning("ID").compile()).toThrow(
            'Missing bind type for returning column "ID"',
        );
    });

    it("should match bind types ignoring case and underscores", () => {
        const query = (db as unknown as Kysely<CamelCaseDB>)
            .withPlugin(new CamelCasePlugin({ upperCase: true }))
            .insertInto("items")
            .values({ itemName: "Item1" })
            .returning(["id", "itemName"])
            .$call(withReturning({ id: oracledb.NUMBER, itemName: oracledb.STRING }))
            .compile() as OracleCompiledQuery;

        expect(query.sql).toBe('insert into "ITEMS" ("ITEM_NAME") values (:1) returning "ID", "ITEM_NAME" into :2, :3');
        expect(query.parameters).toEqual(["Item1", out(oracledb.NUMBER), out(oracledb.STRING)]);
        expect(query.returningColumns).toEqual(["ID", "ITEM_NAME"]);
    });

    it("should prefer an exact bind type match", () => {
        const query = db
            .insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .returning(sql<number>`ID`.as("ITEM_ID"))
            // Bind keys are type checked, so this needs a cast.
            .$call(withReturning({ itemId: oracledb.STRING, ITEM_ID: oracledb.NUMBER } as any))
            .compile();

        expect(query.parameters).toEqual(["Item1", out(oracledb.NUMBER)]);
    });

    it("should throw when several bind types loosely match a column", () => {
        expect(() =>
            db
                .insertInto("ITEMS")
                .values({ NAME: "Item1" })
                .returning(sql<number>`ID`.as("ITEM_ID"))
                // Bind keys are type checked, so this needs a cast.
                .$call(withReturning({ itemId: oracledb.NUMBER, ITEMID: oracledb.NUMBER } as any))
                .compile(),
        ).toThrow('Ambiguous bind type for returning column "ITEM_ID". It matches "itemId", "ITEMID".');
    });

    it("should throw when returning all columns", () => {
        expect(() => db.insertInto("ITEMS").values({ NAME: "Item1" }).returningAll().compile()).toThrow(
            "Returning all columns is not supported by Oracle.",
        );
        expect(() =>
            db
                .deleteFrom("ITEMS")
                .returning("ITEMS.*" as any)
                .compile(),
        ).toThrow("Returning all columns is not supported by Oracle.");
    });

    it("should throw when returning an expression without an alias", () => {
        expect(() =>
            db
                .insertInto("ITEMS")
                .values({ NAME: "Item1" })
                .returning(sql`lower(NAME)` as any)
                .compile(),
        ).toThrow("Returning an expression requires an alias");
    });

    it("should throw when returning from a merge", () => {
        expect(() =>
            db
                .mergeInto("ITEMS")
                .using("ITEMS as SOURCE", "SOURCE.ID", "ITEMS.ID")
                .whenMatched()
                .thenDelete()
                .returning("ITEMS.ID")
                .compile(),
        ).toThrow("Merge with `returning` is not supported by Oracle.");
    });
});

describe("withReturning types", () => {
    const db = createDb();

    it("should keep the returned row type", () => {
        const query = db
            .insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .returning(["ID", "NAME"])
            .$call(withReturning({ ID: oracledb.NUMBER, NAME: oracledb.STRING }));

        expectTypeOf(query.executeTakeFirstOrThrow).returns.resolves.toEqualTypeOf<{ ID: number; NAME: string }>();
    });

    it("should require a bind for every returned column and no others", () => {
        db.insertInto("ITEMS")
            .values({ NAME: "Item1" })
            .returning(["ID", "NAME"])
            // @ts-expect-error NAME is missing
            .$call(withReturning({ ID: oracledb.NUMBER }));

        db.updateTable("ITEMS")
            .set({ NAME: "Item1" })
            .returning("ID as itemId")
            // @ts-expect-error ID isn't returned, only its alias
            .$call(withReturning({ itemId: oracledb.NUMBER, ID: oracledb.NUMBER }));

        db.deleteFrom("ITEMS")
            .returning("NAME")
            // @ts-expect-error keys are case sensitive
            .$call(withReturning({ name: oracledb.STRING }));
    });

    it("should only accept queries with a returning clause", () => {
        db.insertInto("ITEMS")
            .values({ NAME: "Item1" })
            // @ts-expect-error no returning clause
            .$call(withReturning({ ID: oracledb.NUMBER }));

        db.selectFrom("ITEMS")
            .select("ID")
            // @ts-expect-error not an insert, update or delete
            .$call(withReturning({ ID: oracledb.NUMBER }));
    });
});
