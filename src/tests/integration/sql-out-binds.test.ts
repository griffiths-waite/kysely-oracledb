import { CamelCasePlugin, Kysely, sql } from "kysely";
import oracledb from "oracledb";
import { describe, expect, it } from "vitest";
import { OracleQueryResult } from "../../dialect/connection";
import { OracleDialect } from "../../dialect/dialect";

describe("out binds", () => {
    it("should return out binds from a PL/SQL block", async (context) => {
        const result = (await sql`
            begin
                ${{ dir: oracledb.BIND_OUT, type: oracledb.NUMBER }} := 42;
                ${{ dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 }} := 'Item' || ${"1"};
            end;
        `.execute(context.db)) as OracleQueryResult<unknown, [number, string]>;

        expect(result.outBinds).toEqual([42, "Item1"]);
    });

    it("should return out binds from a procedure", async (context) => {
        await sql`
            create procedure GET_ITEM_COUNT(P_CODE in char, P_COUNT out number) as
            begin
                select count(*) into P_COUNT from ITEMS where CODE = P_CODE;
            end;
        `.execute(context.db);

        await context.db
            .insertInto("ITEMS")
            .values([
                { NAME: "Item1", CODE: "A" },
                { NAME: "Item2", CODE: "A" },
                { NAME: "Item3", CODE: "B" },
            ])
            .execute();

        const result = (await sql`
            begin
                GET_ITEM_COUNT(${"A"}, ${{ dir: oracledb.BIND_OUT, type: oracledb.NUMBER }});
            end;
        `.execute(context.db)) as OracleQueryResult<unknown, [number]>;

        expect(result.outBinds).toEqual([2]);
    });

    it("should return in out binds", async (context) => {
        await sql`
            create procedure ADD_ONE(P_VALUE in out number) as
            begin
                P_VALUE := P_VALUE + 1;
            end;
        `.execute(context.db);

        const result = (await sql`
            begin
                ADD_ONE(${{ dir: oracledb.BIND_INOUT, type: oracledb.NUMBER, val: 20 }});
            end;
        `.execute(context.db)) as OracleQueryResult<unknown, [number]>;

        expect(result.outBinds).toEqual([21]);
    });

    it("should return out binds with a result plugin", async (context) => {
        const db = new Kysely<any>({
            dialect: new OracleDialect({
                pool: context.getPool(),
            }),
            plugins: [new CamelCasePlugin({ upperCase: true })],
        });

        const result = (await sql`
            begin
                ${{ dir: oracledb.BIND_OUT, type: oracledb.NUMBER }} := 42;
            end;
        `.execute(db)) as OracleQueryResult<unknown, [number]>;

        expect(result.outBinds).toEqual([42]);
    });
});
