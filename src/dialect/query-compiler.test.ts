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

    it("should add quotes to identifiers by default", async () => {
        const queryCompiler = new OracleQueryCompiler();

        const rootNode = {
            kind: "SelectQueryNode",
            from: {
                kind: "FromNode",
                froms: [
                    {
                        kind: "TableNode",
                        table: {
                            kind: "SchemableIdentifierNode",
                            identifier: {
                                kind: "IdentifierNode",
                                name: "MY_TABLE",
                            },
                        },
                    },
                ],
            },
            selections: [
                {
                    kind: "SelectionNode",
                    selection: {
                        kind: "ReferenceNode",
                        column: {
                            kind: "ColumnNode",
                            column: {
                                kind: "IdentifierNode",
                                name: "MY_COLUMN",
                            },
                        },
                    },
                },
            ],
        } as const;

        const compiledQuery = queryCompiler.compileQuery(rootNode, { queryId: "test-id" });

        expect(compiledQuery.sql).toBe('select "MY_COLUMN" from "MY_TABLE"');
    });

    it("should not add quotes to identifiers when using non quoted identifier option", async () => {
        const queryCompiler = new OracleQueryCompiler({ useNonQuotedIdentifiers: true });

        const rootNode = {
            kind: "SelectQueryNode",
            from: {
                kind: "FromNode",
                froms: [
                    {
                        kind: "TableNode",
                        table: {
                            kind: "SchemableIdentifierNode",
                            identifier: {
                                kind: "IdentifierNode",
                                name: "MY_TABLE",
                            },
                        },
                    },
                ],
            },
            selections: [
                {
                    kind: "SelectionNode",
                    selection: {
                        kind: "ReferenceNode",
                        column: {
                            kind: "ColumnNode",
                            column: {
                                kind: "IdentifierNode",
                                name: "MY_COLUMN",
                            },
                        },
                    },
                },
            ],
        } as const;

        const compiledQuery = queryCompiler.compileQuery(rootNode, { queryId: "test-id" });

        expect(compiledQuery.sql).toBe("select MY_COLUMN from MY_TABLE");
    });

    it("should quote aliases when using non quoted identifier option", async () => {
        const queryCompiler = new OracleQueryCompiler({ useNonQuotedIdentifiers: true });

        const rootNode = {
            kind: "SelectQueryNode",
            from: {
                kind: "FromNode",
                froms: [
                    {
                        kind: "TableNode",
                        table: {
                            kind: "SchemableIdentifierNode",
                            identifier: { kind: "IdentifierNode", name: "MY_TABLE" },
                        },
                    },
                ],
            },
            selections: [
                {
                    kind: "SelectionNode",
                    selection: {
                        kind: "AliasNode",
                        node: {
                            kind: "ReferenceNode",
                            column: { kind: "ColumnNode", column: { kind: "IdentifierNode", name: "MY_COLUMN" } },
                        },
                        alias: { kind: "IdentifierNode", name: "myColumn" },
                    },
                },
            ],
        } as const;

        const compiledQuery = queryCompiler.compileQuery(rootNode, { queryId: "test-id" });

        expect(compiledQuery.sql).toBe('select MY_COLUMN "myColumn" from MY_TABLE');
    });
});
