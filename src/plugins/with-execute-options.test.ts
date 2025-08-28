import { describe, expect, it } from "vitest";
import { withExecuteOptions } from "./with-execute-options";

describe("withExecuteOptions", () => {
    it("should add executeOptions to the query node", () => {
        const plugin = withExecuteOptions({ autoCommit: true });

        const transformed = plugin.transformQuery({
            node: { kind: "SelectQueryNode" },
            queryId: { queryId: "test-id" },
        });

        expect(transformed.executeOptions).toEqual({ autoCommit: true });
    });

    it("should return the result unchanged", async () => {
        const plugin = withExecuteOptions({ autoCommit: true });

        const output = await plugin.transformResult({ result: { rows: [] }, queryId: { queryId: "test-id" } });

        expect(output).toEqual({ rows: [] });
    });
});
