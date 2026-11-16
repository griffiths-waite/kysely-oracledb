import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, TestContext, vi } from "vitest";
import { EXIT_ERROR, EXIT_OUT_OF_DATE, EXIT_SUCCESS, runCli } from "../../cli/run";
import { generate } from "../../generator/generate";

describe("cli", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(process.cwd(), "tmp"));

        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    const run = (context: TestContext, args: string[] = []) =>
        runCli(
            ["generate", "--schemas", context.testId, "--type", "tables", "-o", `${tmpDir}/types.ts`, ...args],
            {
                ORACLE_USER: context.testId,
                ORACLE_PASSWORD: "oracle",
                ORACLE_CONNECT_STRING: "localhost:1521/FREEPDB1",
            },
            { version: "0.0.0" },
        );

    it("should generate the same types as the generate function", async (context) => {
        expect(await run(context)).toBe(EXIT_SUCCESS);

        const { types } = await generate({
            pool: await context.createPool(),
            introspectorOptions: { schemas: [context.testId], type: "tables" },
            write: false,
        });

        expect(fs.readFileSync(`${tmpDir}/types.ts`, "utf8")).toEqual(types);
    });

    it("should generate camelCase types", async (context) => {
        expect(await run(context, ["--camel-case"])).toBe(EXIT_SUCCESS);

        expect(fs.readFileSync(`${tmpDir}/types.ts`, "utf8")).toContain("createdAt: ColumnType<Date");
    });

    it("should write a metadata file", async (context) => {
        expect(await run(context, ["--metadata-out", `${tmpDir}/tables.json`])).toBe(EXIT_SUCCESS);

        expect(fs.existsSync(`${tmpDir}/tables.json`)).toBe(true);
    });

    it("should log to stdout unless quiet", async (context) => {
        await run(context);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Generated files updated"));

        vi.mocked(console.log).mockClear();

        await run(context, ["--quiet"]);

        expect(console.log).not.toHaveBeenCalled();
    });

    describe("check", () => {
        it("should report out of date files without writing", async (context) => {
            expect(await run(context, ["--check"])).toBe(EXIT_OUT_OF_DATE);

            expect(fs.existsSync(`${tmpDir}/types.ts`)).toBe(false);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("out of date"));
        });

        it("should report up to date files", async (context) => {
            await run(context);

            expect(await run(context, ["--check"])).toBe(EXIT_SUCCESS);
        });

        it("should report out of date metadata", async (context) => {
            await run(context);

            expect(await run(context, ["--check", "--metadata-out", `${tmpDir}/tables.json`])).toBe(EXIT_OUT_OF_DATE);
            expect(fs.existsSync(`${tmpDir}/tables.json`)).toBe(false);
        });
    });

    describe("errors", () => {
        it("should return an error code for invalid credentials", async (context) => {
            const code = await runCli(
                ["generate", "-o", `${tmpDir}/types.ts`],
                { ORACLE_USER: context.testId, ORACLE_PASSWORD: "wrong", ORACLE_CONNECT_STRING: "localhost:1521/FREEPDB1" },
                { version: "0.0.0" },
            );

            expect(code).toBe(EXIT_ERROR);
            expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^error: /));
        });

        it("should return an error code for usage errors", async () => {
            expect(await runCli(["generate", "--type", "invalid"], {}, { version: "0.0.0" })).toBe(EXIT_ERROR);
        });
    });
});
