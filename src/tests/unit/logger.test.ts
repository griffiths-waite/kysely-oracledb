import { CompiledQuery } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatLogEvent, OracleLog, QueryLogEvent } from "../../dialect/logger";

const query = (sql: string, parameters: unknown[] = []): CompiledQuery => CompiledQuery.raw(sql, parameters);

const queryEvent = (): QueryLogEvent => ({
    level: "query",
    connectionId: "conn-1",
    query: query("select * from DUAL"),
    queryDurationMillis: 1.25,
});

describe("OracleLog", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should disable every level when no config is given", () => {
        const log = new OracleLog();

        expect(log.isLevelEnabled("query")).toBe(false);
        expect(log.isLevelEnabled("error")).toBe(false);
        expect(log.isLevelEnabled("connection")).toBe(false);
        expect(log.isLevelEnabled("transaction")).toBe(false);
    });

    it("should only enable the listed levels", () => {
        const log = new OracleLog(["query", "transaction"]);

        expect(log.isLevelEnabled("query")).toBe(true);
        expect(log.isLevelEnabled("error")).toBe(false);
        expect(log.isLevelEnabled("connection")).toBe(false);
        expect(log.isLevelEnabled("transaction")).toBe(true);
    });

    it("should enable every level and pass events to a logger function", async () => {
        const logger = vi.fn();
        const log = new OracleLog(logger);

        expect(log.isLevelEnabled("query")).toBe(true);
        expect(log.isLevelEnabled("error")).toBe(true);
        expect(log.isLevelEnabled("connection")).toBe(true);
        expect(log.isLevelEnabled("transaction")).toBe(true);

        const event = queryEvent();
        await log.log("query", () => event);

        expect(logger).toHaveBeenCalledWith(event);
    });

    it("should only pass the listed levels to a logger function", async () => {
        const logger = vi.fn();
        const log = new OracleLog({ levels: ["error"], logger });

        expect(log.isLevelEnabled("query")).toBe(false);
        expect(log.isLevelEnabled("error")).toBe(true);

        await log.log("query", queryEvent);

        expect(logger).not.toHaveBeenCalled();
    });

    it("should enable every level when an options object has no levels", () => {
        const log = new OracleLog({ logger: vi.fn() });

        expect(log.isLevelEnabled("query")).toBe(true);
        expect(log.isLevelEnabled("error")).toBe(true);
        expect(log.isLevelEnabled("connection")).toBe(true);
        expect(log.isLevelEnabled("transaction")).toBe(true);
    });

    it("should use the console logger when an options object has no logger", async () => {
        await new OracleLog({ levels: ["query"] }).log("query", queryEvent);

        expect(console.log).toHaveBeenCalledWith("kysely-oracledb:query: select * from DUAL (1.3ms)");
    });

    it("should not create the event when the level is disabled", async () => {
        const getEvent = vi.fn(queryEvent);

        await new OracleLog(["error"]).log("query", getEvent);

        expect(getEvent).not.toHaveBeenCalled();
    });

    it("should log queries to the console by default", async () => {
        await new OracleLog(["query"]).log("query", queryEvent);

        expect(console.log).toHaveBeenCalledWith("kysely-oracledb:query: select * from DUAL (1.3ms)");
    });

    it("should log connection and transaction events to the console by default", async () => {
        const log = new OracleLog(["connection", "transaction"]);

        await log.log("connection", () => ({
            level: "connection",
            connectionId: "conn-1",
            action: "acquire",
            durationMillis: 2,
        }));
        await log.log("transaction", () => ({
            level: "transaction",
            connectionId: "conn-1",
            action: "savepoint",
            savepoint: "sp1",
        }));

        expect(console.log).toHaveBeenCalledWith("kysely-oracledb:connection: acquire conn-1 (2.0ms)");
        expect(console.log).toHaveBeenCalledWith("kysely-oracledb:transaction: savepoint sp1 conn-1");
    });

    it("should log errors to the console by default", async () => {
        const error = new Error("ORA-00942: table or view does not exist");

        await new OracleLog(["error"]).log("error", () => ({ level: "error", connectionId: "conn-1", error }));

        expect(console.error).toHaveBeenCalledWith(`kysely-oracledb:error: ${error.stack}`);
    });
});

describe("formatLogEvent", () => {
    it("should format the same message as the console logger", () => {
        expect(formatLogEvent(queryEvent())).toBe("kysely-oracledb:query: select * from DUAL (1.3ms)");
        expect(
            formatLogEvent({ level: "transaction", connectionId: "conn-1", action: "commit", durationMillis: 0.5 }),
        ).toBe("kysely-oracledb:transaction: commit conn-1 (0.5ms)");
    });

    it("should format errors that aren't Error instances as JSON", () => {
        expect(formatLogEvent({ level: "error", connectionId: "conn-1", error: "failed" })).toBe(
            'kysely-oracledb:error: {"error":"failed"}',
        );
    });
});
