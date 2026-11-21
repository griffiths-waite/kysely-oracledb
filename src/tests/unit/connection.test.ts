import oracledb, { Connection } from "oracledb";
import { afterEach, describe, expect, it } from "vitest";
import { OracleConnection } from "../../dialect/connection";
import { OracleLog } from "../../dialect/logger";

describe("OracleConnection", () => {
    const connection = new OracleConnection({} as Connection, new OracleLog());

    describe("formatReturningRows", () => {
        it("should turn out binds into rows", async () => {
            const rows = await connection.formatReturningRows(
                ["ID", "NAME"],
                [
                    [1, 2],
                    ["Item1", "Item2"],
                ],
            );

            expect(rows).toEqual([
                { ID: 1, NAME: "Item1" },
                { ID: 2, NAME: "Item2" },
            ]);
        });

        it("should return no rows when nothing was affected", async () => {
            expect(await connection.formatReturningRows(["ID"], [[]])).toEqual([]);
        });

        it("should use the last out binds", async () => {
            expect(await connection.formatReturningRows(["ID"], ["other", [1]])).toEqual([{ ID: 1 }]);
        });

        it.each([
            ["missing", undefined],
            ["not an array", { 0: [1] }],
            ["too short", [[1]]],
            ["not arrays of values", [1, 2]],
        ])("should throw when out binds are %s", async (_, outBinds) => {
            await expect(connection.formatReturningRows(["ID", "NAME"], outBinds)).rejects.toThrow(
                "Unexpected out binds for `returning ... into`.",
            );
        });
    });

    describe("formatReturningValue", () => {
        const { fetchAsString, fetchAsBuffer } = oracledb;

        afterEach(() => {
            oracledb.fetchAsString = fetchAsString;
            oracledb.fetchAsBuffer = fetchAsBuffer;
        });

        const createLob = (type: unknown, data: unknown) =>
            Object.create(oracledb.Lob.prototype, {
                type: { value: type },
                getData: { value: async () => data },
            }) as oracledb.Lob;

        it("should read lobs fetched as strings or buffers", async () => {
            oracledb.fetchAsString = [oracledb.CLOB];
            oracledb.fetchAsBuffer = [oracledb.BLOB];

            expect(await connection.formatReturningValue(createLob(oracledb.CLOB, "Notes"))).toBe("Notes");
            expect(await connection.formatReturningValue(createLob(oracledb.BLOB, Buffer.from("Data")))).toEqual(
                Buffer.from("Data"),
            );
        });

        it("should leave other lobs and values as they are", async () => {
            oracledb.fetchAsString = [];
            oracledb.fetchAsBuffer = [];

            const lob = createLob(oracledb.CLOB, "Notes");

            expect(await connection.formatReturningValue(lob)).toBe(lob);
            expect(await connection.formatReturningValue("Notes")).toBe("Notes");
        });
    });
});
