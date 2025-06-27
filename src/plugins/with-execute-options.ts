import { KyselyPlugin } from "kysely";
import { ExecuteOptions } from "oracledb";

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
