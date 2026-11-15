import { ColumnMetadata } from "kysely";
import { describe, expect, it } from "vitest";
import { findUnsafeColumns } from "../../generator/generate";
import { column, table } from "./fixtures/metadata";

const withColumns = (...columns: ColumnMetadata[]) => [table("ITEMS", columns)];

describe("findUnsafeColumns", () => {
    it("should return columns that won't convert using the given options", () => {
        const tables = withColumns(column("ISO_2CHAR_CODE", "CHAR"), column("USER_LINE1_ADDRESS", "VARCHAR2"));

        expect(findUnsafeColumns(tables, {})).toEqual(["ISO_2CHAR_CODE (iso2charCode)"]);
        expect(findUnsafeColumns(tables, { underscoreBeforeDigits: true })).toEqual([
            "USER_LINE1_ADDRESS (userLine1Address)",
        ]);
    });

    it("should return no columns when all columns convert safely", () => {
        const tables = withColumns(column("NAME", "VARCHAR2"), column("USER_LINE1_ADDRESS", "VARCHAR2"));

        expect(findUnsafeColumns(tables, {})).toEqual([]);
    });
});
