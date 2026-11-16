import fs from "fs";
import { parseArgs, parseEnv } from "util";
import { GeneratorConfig } from "../generator/generate.js";

export const HELP_TEXT = `Usage: kysely-oracledb <command> [options]

Commands:
  generate                                  Generate Kysely types using database introspection

Connection options:
  --user <name>                             Database user (env: ORACLE_USER)
  --password <password>                     Database password (env: ORACLE_PASSWORD, recommended)
  --connect-string <string>                 Connect string, e.g. localhost:1521/FREEPDB1 (env: ORACLE_CONNECT_STRING)
  --env-file <path>                         Load environment variables from a file
  --thick                                   Enable node-oracledb thick mode
  --lib-dir <path>                          Oracle Client library directory (implies --thick)

Introspection options:
  --type <tables|views>                     Filter by object type
  --schemas <a,b>                           Filter by schema name (comma-separated or repeated)
  --tables <a,b>                            Filter by table or view name (comma-separated or repeated)

Output options:
  -o, --out <path>                          Types file path (default: types.ts)
  --metadata                                Output the table metadata
  --metadata-out <path>                     Metadata file path (default: tables.json, implies --metadata)
  --camel-case                              Use camelCase for generated types
  --underscore-before-digits                CamelCasePlugin option used to detect unsafe columns
  --underscore-between-uppercase-letters    CamelCasePlugin option used to detect unsafe columns

Other options:
  --check                                   Exit with code 1 if generated files are out of date, without writing
  --quiet                                   Only output warnings and errors
  -h, --help                                Show help
  --version                                 Show version
`;

export class CliUsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CliUsageError";
    }
}

export interface ConnectionOptions {
    user: string;
    password: string;
    connectString: string;
}

export interface GenerateCommand {
    kind: "generate";
    connection: ConnectionOptions;
    thick: boolean;
    libDir?: string;
    check: boolean;
    quiet: boolean;
    config: Omit<GeneratorConfig, "pool">;
}

export type CliCommand = { kind: "help" } | { kind: "version" } | GenerateCommand;

type Env = Record<string, string | undefined>;

const options = {
    user: { type: "string" },
    password: { type: "string" },
    "connect-string": { type: "string" },
    "env-file": { type: "string" },
    thick: { type: "boolean" },
    "lib-dir": { type: "string" },
    type: { type: "string" },
    schemas: { type: "string", multiple: true },
    tables: { type: "string", multiple: true },
    out: { type: "string", short: "o" },
    metadata: { type: "boolean" },
    "metadata-out": { type: "string" },
    "camel-case": { type: "boolean" },
    "underscore-before-digits": { type: "boolean" },
    "underscore-between-uppercase-letters": { type: "boolean" },
    check: { type: "boolean" },
    quiet: { type: "boolean" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean" },
} as const;

const parse = (argv: string[]) => {
    try {
        return parseArgs({ args: argv, options, allowPositionals: true, strict: true });
    } catch (error) {
        throw new CliUsageError(error instanceof Error ? error.message : String(error));
    }
};

const toList = (values: string[] | undefined): string[] | undefined => {
    const list = (values ?? []).flatMap((value) => value.split(",")).map((value) => value.trim());
    const filtered = list.filter((value) => value.length > 0);

    return filtered.length > 0 ? filtered : undefined;
};

const loadEnv = (env: Env, envFile: string | undefined): Env => {
    if (!envFile) {
        return env;
    }

    let content: string;

    try {
        content = fs.readFileSync(envFile, "utf8");
    } catch {
        throw new CliUsageError(`Unable to read env file: ${envFile}`);
    }

    return { ...parseEnv(content), ...env };
};

const resolveConnection = (
    values: { user?: string; password?: string; "connect-string"?: string },
    env: Env,
): ConnectionOptions => {
    const user = values.user ?? env.ORACLE_USER;
    const password = values.password ?? env.ORACLE_PASSWORD;
    const connectString = values["connect-string"] ?? env.ORACLE_CONNECT_STRING;

    const missing = [
        ...(user ? [] : ["--user (ORACLE_USER)"]),
        ...(password ? [] : ["--password (ORACLE_PASSWORD)"]),
        ...(connectString ? [] : ["--connect-string (ORACLE_CONNECT_STRING)"]),
    ];

    if (!user || !password || !connectString) {
        throw new CliUsageError(`Missing connection options: ${missing.join(", ")}`);
    }

    return { user, password, connectString };
};

const resolveType = (type: string | undefined): "tables" | "views" | undefined => {
    if (type === undefined || type === "tables" || type === "views") {
        return type;
    }

    throw new CliUsageError(`Invalid --type "${type}", expected "tables" or "views"`);
};

/**
 * Parse CLI arguments into a command. Environment variables are used as a fallback for
 * connection options.
 */
export const parseCliArgs = (argv: string[], env: Env): CliCommand => {
    const { values, positionals } = parse(argv);

    if (values.help) {
        return { kind: "help" };
    }

    if (values.version) {
        return { kind: "version" };
    }

    const [command, ...rest] = positionals;

    if (command === undefined) {
        return { kind: "help" };
    }

    if (command !== "generate") {
        throw new CliUsageError(`Unknown command "${command}"`);
    }

    if (rest.length > 0) {
        throw new CliUsageError(`Unexpected argument "${rest[0]}"`);
    }

    const connection = resolveConnection(values, loadEnv(env, values["env-file"]));

    const type = resolveType(values.type);
    const schemas = toList(values.schemas);
    const tables = toList(values.tables);

    const camelCaseOptions = {
        ...(values["underscore-before-digits"] ? { underscoreBeforeDigits: true } : {}),
        ...(values["underscore-between-uppercase-letters"] ? { underscoreBetweenUppercaseLetters: true } : {}),
    };

    return {
        kind: "generate",
        connection,
        thick: Boolean(values.thick || values["lib-dir"]),
        libDir: values["lib-dir"],
        check: Boolean(values.check),
        quiet: Boolean(values.quiet),
        config: {
            introspectorOptions: {
                ...(type ? { type } : {}),
                ...(schemas ? { schemas } : {}),
                ...(tables ? { tables } : {}),
            },
            camelCase: Boolean(values["camel-case"]),
            camelCaseOptions,
            metadata: Boolean(values.metadata || values["metadata-out"]),
            ...(values.out ? { filePath: values.out } : {}),
            ...(values["metadata-out"] ? { metadataFilePath: values["metadata-out"] } : {}),
        },
    };
};
