import { KyselyPlugin } from "kysely";
import { ExecuteOptions } from "oracledb";

/**
 * A plugin to add execute options for a query:
 *
 * ```ts
 * const result = await db
 *     .insertInto("USERS")
 *     .values({ NAME: "User" })
 *     .withPlugin(withExecuteOptions({ autoCommit: true }))
 *     .executeTakeFirst();
 * ```
 *
 * Options passed via this plugin take priority over dialect execute options.
 */
export const withExecuteOptions = (executeOptions: ExecuteOptions) => {
    return {
        transformQuery: ({ node }) => {
            return {
                ...node,
                executeOptions,
            };
        },
        transformResult: async ({ result }) => {
            return result;
        },
    } satisfies KyselyPlugin;
};
