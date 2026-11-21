import {
    DeleteQueryBuilder,
    DeleteResult,
    InsertQueryBuilder,
    InsertResult,
    KyselyPlugin,
    UpdateQueryBuilder,
    UpdateResult,
} from "kysely";
import { DbType } from "oracledb";

export type ReturningBindType = number | DbType;

export type ReturningBind =
    | ReturningBindType
    | {
          type: ReturningBindType;
          maxSize?: number;
      };

export type ReturningBinds = Record<string, ReturningBind>;

export type ReturningQueryBuilder =
    InsertQueryBuilder<any, any, any> | UpdateQueryBuilder<any, any, any, any> | DeleteQueryBuilder<any, any, any>;

type ReturningOutput<QB> =
    QB extends InsertQueryBuilder<any, any, infer O>
        ? O
        : QB extends UpdateQueryBuilder<any, any, any, infer O>
          ? O
          : QB extends DeleteQueryBuilder<any, any, infer O>
            ? O
            : never;

/**
 * A bind for every column of the query's `returning` clause, and no others. Queries without a
 * `returning` clause still output Kysely's result objects, so they accept no binds.
 */
export type ReturningBindsFor<QB> =
    ReturningOutput<QB> extends InsertResult | UpdateResult | DeleteResult
        ? never
        : { [K in keyof ReturningOutput<QB>]: ReturningBind };

/**
 * Sets the out bind types for a `returning` clause, which Oracle compiles to
 * `returning ... into :n`. Pass it to `$call` after `returning`:
 *
 * ```ts
 * const item = await db
 *     .insertInto("ITEMS")
 *     .values({ NAME: "Item" })
 *     .returning(["ID", "NAME"])
 *     .$call(withReturning({ ID: oracledb.NUMBER, NAME: { type: oracledb.STRING, maxSize: 100 } }))
 *     .executeTakeFirstOrThrow();
 * ```
 *
 * Each key is a key of the returned row, and every returned column needs a type. Missing or extra
 * keys are type errors.
 */
export const withReturning = <QB extends ReturningQueryBuilder>(returningBinds: ReturningBindsFor<QB>) => {
    const plugin = {
        transformQuery: ({ node }) => {
            return {
                ...node,
                returningBinds,
            };
        },
        transformResult: async ({ result }) => {
            return result;
        },
    } satisfies KyselyPlugin;

    return (qb: QB): QB => qb.withPlugin(plugin) as QB;
};
