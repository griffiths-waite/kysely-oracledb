import { describe, expect, it } from "vitest";
import { OracleNode, OracleQueryCompiler } from "./query-compiler";

describe("OracleQueryCompiler", () => {
    it("should add executeOptions to compiled query if included in node", () => {
        const queryCompiler = new OracleQueryCompiler();

        const node = {
            kind: "SelectQueryNode",
            executeOptions: {
                autoCommit: true,
            },
        } as OracleNode;

        const compiledQuery = queryCompiler.compileQuery(node, { queryId: "test-id" });

        expect(compiledQuery.executeOptions).toEqual({
            autoCommit: true,
        });
    });
});
