import { Kysely } from "kysely";
import { afterEach, describe, expect, it, TestContext, vi } from "vitest";
import { OracleDialect } from "../../dialect/dialect";
import { OracleLogConfig, OracleLogEvent } from "../../dialect/logger";
import { DB } from "./fixtures/types-snake-case";

describe("logging", () => {
    let db: Kysely<DB> | undefined;

    afterEach(async () => {
        await db?.destroy();
        db = undefined;
    });

    const createDb = async (context: TestContext, log: OracleLogConfig) => {
        db = new Kysely<DB>({
            dialect: new OracleDialect({ pool: await context.createPool(), log }),
        });
        return db;
    };

    const summarise = (events: OracleLogEvent[]) =>
        events.map((event) => (event.level === "transaction" ? `transaction:${event.action}` : event.level));

    it("should log connection and query events", async (context) => {
        const logger = vi.fn<(event: OracleLogEvent) => void>();
        const db = await createDb(context, logger);

        await db.selectFrom("ITEMS").select("ID").where("NAME", "=", "Item1").execute();

        const events = logger.mock.calls.map(([event]) => event);

        expect(events).toEqual([
            expect.objectContaining({ level: "connection", action: "acquire" }),
            expect.objectContaining({
                level: "query",
                query: expect.objectContaining({
                    sql: 'select "ID" from "ITEMS" where "NAME" = :1',
                    parameters: ["Item1"],
                }),
            }),
            expect.objectContaining({ level: "connection", action: "release" }),
        ]);
        expect(new Set(events.map((event) => event.connectionId)).size).toBe(1);
    });

    it("should log transaction events", async (context) => {
        const logger = vi.fn<(event: OracleLogEvent) => void>();
        const db = await createDb(context, logger);

        const trx = await db.startTransaction().execute();
        await trx.insertInto("ITEMS").values({ NAME: "Item1" }).execute();
        const trxAfterSavepoint = await trx.savepoint("first_item").execute();
        await trxAfterSavepoint.rollbackToSavepoint("first_item").execute();
        await trx.commit().execute();

        // Kysely releases the connection of a controlled transaction without awaiting it.
        await vi.waitFor(() =>
            expect(summarise(logger.mock.calls.map(([event]) => event))).toEqual([
                "connection",
                "transaction:begin",
                "query",
                "query",
                "transaction:savepoint",
                "query",
                "transaction:rollbackToSavepoint",
                "transaction:commit",
                "connection",
            ]),
        );
    });

    it("should log transaction rollbacks", async (context) => {
        const logger = vi.fn<(event: OracleLogEvent) => void>();
        const db = await createDb(context, logger);

        await expect(
            db.transaction().execute(async (trx) => {
                await trx.insertInto("ITEMS").values({ NAME: "Item1" }).execute();
                throw new Error("Rollback transaction");
            }),
        ).rejects.toThrow("Rollback transaction");

        expect(summarise(logger.mock.calls.map(([event]) => event))).toEqual([
            "connection",
            "transaction:begin",
            "query",
            "transaction:rollback",
            "connection",
        ]);
    });

    it("should log query errors", async (context) => {
        const logger = vi.fn<(event: OracleLogEvent) => void>();
        const db = await createDb(context, logger);

        await expect(db.selectFrom("MISSING" as any).selectAll().execute()).rejects.toThrow("ORA-00942");

        expect(logger).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                error: expect.objectContaining({ message: expect.stringContaining("ORA-00942") }),
                query: expect.objectContaining({ sql: 'select * from "MISSING"' }),
            }),
        );
        expect(logger).not.toHaveBeenCalledWith(expect.objectContaining({ level: "query" }));
    });

    it("should only log the configured levels", async (context) => {
        const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

        try {
            const db = await createDb(context, ["transaction"]);

            await db.transaction().execute(async (trx) => {
                await trx.selectFrom("ITEMS").select("ID").execute();
            });

            const messages = consoleLog.mock.calls.map(([message]) => message);

            expect(messages).toHaveLength(2);
            expect(messages[0]).toMatch(/^kysely-oracledb:transaction: begin /);
            expect(messages[1]).toMatch(/^kysely-oracledb:transaction: commit /);
        } finally {
            consoleLog.mockRestore();
        }
    });
});
