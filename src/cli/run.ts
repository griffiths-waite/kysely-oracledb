import oracledb from "oracledb";
import { defaultLogger, Logger } from "../dialect/logger.js";
import { generate } from "../generator/generate.js";
import { CliUsageError, GenerateCommand, HELP_TEXT, parseCliArgs } from "./args.js";

export interface RunCliOptions {
    version: string;
}

export const EXIT_SUCCESS = 0;
export const EXIT_OUT_OF_DATE = 1;
export const EXIT_ERROR = 2;

const createLogger = (quiet: boolean): Logger => ({
    ...defaultLogger,
    info: quiet ? defaultLogger.info : console.log,
    warn: console.warn,
    error: console.error,
    fatal: console.error,
});

const runGenerate = async (command: GenerateCommand): Promise<number> => {
    if (command.thick) {
        oracledb.initOracleClient(command.libDir ? { libDir: command.libDir } : undefined);
    }

    const pool = await oracledb.createPool(command.connection);

    const result = await generate({
        ...command.config,
        pool,
        logger: createLogger(command.quiet),
        write: !command.check,
    });

    if (command.check && (result.changed || result.metadataChanged)) {
        console.error('Generated files are out of date. Run "kysely-oracledb generate" to update.');
        return EXIT_OUT_OF_DATE;
    }

    return EXIT_SUCCESS;
};

export const runCli = async (
    argv: string[],
    env: Record<string, string | undefined>,
    options: RunCliOptions,
): Promise<number> => {
    try {
        const command = parseCliArgs(argv, env);

        switch (command.kind) {
            case "help":
                console.log(HELP_TEXT);
                return EXIT_SUCCESS;
            case "version":
                console.log(options.version);
                return EXIT_SUCCESS;
            case "generate":
                return await runGenerate(command);
        }
    } catch (error) {
        console.error(`error: ${error instanceof Error ? error.message : String(error)}`);

        if (error instanceof CliUsageError) {
            console.error('Run "kysely-oracledb --help" for usage.');
        }

        return EXIT_ERROR;
    }
};
