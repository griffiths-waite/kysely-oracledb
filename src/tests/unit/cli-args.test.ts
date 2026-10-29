import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CliUsageError, GenerateCommand, parseCliArgs } from "../../cli/args";

const env = {
    ORACLE_USER: "env_user",
    ORACLE_PASSWORD: "env_password",
    ORACLE_CONNECT_STRING: "env:1521/ENV",
};

const parseGenerate = (argv: string[], environment: Record<string, string | undefined> = env): GenerateCommand => {
    const command = parseCliArgs(["generate", ...argv], environment);

    if (command.kind !== "generate") {
        throw new Error(`Expected generate command, received ${command.kind}`);
    }

    return command;
};

describe("parseCliArgs", () => {
    describe("commands", () => {
        it("should return help when no command is given", () => {
            expect(parseCliArgs([], {})).toEqual({ kind: "help" });
        });

        it("should return help for the help flag", () => {
            expect(parseCliArgs(["--help"], {})).toEqual({ kind: "help" });
            expect(parseCliArgs(["generate", "-h"], {})).toEqual({ kind: "help" });
        });

        it("should return version for the version flag", () => {
            expect(parseCliArgs(["--version"], {})).toEqual({ kind: "version" });
        });

        it("should throw for an unknown command", () => {
            expect(() => parseCliArgs(["migrate"], env)).toThrow(CliUsageError);
        });

        it("should throw for unexpected arguments", () => {
            expect(() => parseCliArgs(["generate", "extra"], env)).toThrow(CliUsageError);
        });

        it("should throw for an unknown flag", () => {
            expect(() => parseCliArgs(["generate", "--unknown"], env)).toThrow(CliUsageError);
        });
    });

    describe("defaults", () => {
        it("should return default options", () => {
            expect(parseGenerate([])).toEqual({
                kind: "generate",
                connection: { user: "env_user", password: "env_password", connectString: "env:1521/ENV" },
                thick: false,
                libDir: undefined,
                check: false,
                quiet: false,
                config: {
                    introspectorOptions: {},
                    camelCase: false,
                    camelCaseOptions: {},
                    metadata: false,
                },
            });
        });
    });

    describe("connection", () => {
        it("should prefer flags over environment variables", () => {
            const command = parseGenerate(["--user", "u", "--password", "p", "--connect-string", "c"]);

            expect(command.connection).toEqual({ user: "u", password: "p", connectString: "c" });
        });

        it("should throw listing missing connection options", () => {
            expect(() => parseGenerate(["--user", "u"], {})).toThrow(
                "Missing connection options: --password (ORACLE_PASSWORD), --connect-string (ORACLE_CONNECT_STRING)",
            );
        });

        describe("env file", () => {
            let tmpDir: string;

            beforeEach(() => {
                tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kysely-oracledb-"));
            });

            afterEach(() => {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            });

            it("should load connection options from an env file", () => {
                const envFile = path.join(tmpDir, ".env");

                fs.writeFileSync(
                    envFile,
                    "ORACLE_USER=file_user\nORACLE_PASSWORD=file_password\nORACLE_CONNECT_STRING=file:1521/FILE\n",
                );

                expect(parseGenerate(["--env-file", envFile], {}).connection).toEqual({
                    user: "file_user",
                    password: "file_password",
                    connectString: "file:1521/FILE",
                });
            });

            it("should prefer existing environment variables over the env file", () => {
                const envFile = path.join(tmpDir, ".env");

                fs.writeFileSync(envFile, "ORACLE_USER=file_user\nORACLE_PASSWORD=file_password\n");

                expect(parseGenerate(["--env-file", envFile]).connection).toEqual({
                    user: "env_user",
                    password: "env_password",
                    connectString: "env:1521/ENV",
                });
            });

            it("should throw when the env file can't be read", () => {
                expect(() => parseGenerate(["--env-file", path.join(tmpDir, "missing")])).toThrow(CliUsageError);
            });
        });
    });

    describe("thick mode", () => {
        it("should enable thick mode", () => {
            expect(parseGenerate(["--thick"])).toMatchObject({ thick: true, libDir: undefined });
        });

        it("should enable thick mode when a lib dir is given", () => {
            expect(parseGenerate(["--lib-dir", "/opt/oracle"])).toMatchObject({ thick: true, libDir: "/opt/oracle" });
        });
    });

    describe("introspection", () => {
        it("should map introspector options", () => {
            const command = parseGenerate(["--type", "views", "--schemas", "A,B", "--tables", "T1"]);

            expect(command.config.introspectorOptions).toEqual({ type: "views", schemas: ["A", "B"], tables: ["T1"] });
        });

        it("should combine repeated and comma-separated list flags", () => {
            const command = parseGenerate(["--schemas", "A, B,", "--schemas", "C"]);

            expect(command.config.introspectorOptions).toEqual({ schemas: ["A", "B", "C"] });
        });

        it("should throw for an invalid type", () => {
            expect(() => parseGenerate(["--type", "procedures"])).toThrow(CliUsageError);
        });
    });

    describe("output", () => {
        it("should map output options", () => {
            const command = parseGenerate([
                "-o",
                "src/types.ts",
                "--metadata",
                "--camel-case",
                "--underscore-before-digits",
                "--underscore-between-uppercase-letters",
                "--check",
                "--quiet",
            ]);

            expect(command).toMatchObject({
                check: true,
                quiet: true,
                config: {
                    filePath: "src/types.ts",
                    metadata: true,
                    camelCase: true,
                    camelCaseOptions: { underscoreBeforeDigits: true, underscoreBetweenUppercaseLetters: true },
                },
            });
        });

        it("should enable metadata when a metadata path is given", () => {
            const command = parseGenerate(["--metadata-out", "meta/tables.json"]);

            expect(command.config).toMatchObject({ metadata: true, metadataFilePath: "meta/tables.json" });
        });
    });
});
