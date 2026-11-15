import { CompiledQuery } from "kysely";

export const ORACLE_LOG_LEVELS = ["query", "error", "connection", "transaction"] as const;

export type OracleLogLevel = (typeof ORACLE_LOG_LEVELS)[number];

export interface QueryLogEvent {
    readonly level: "query";
    readonly connectionId: string;
    readonly query: CompiledQuery;
    readonly queryDurationMillis: number;
}

export interface ErrorLogEvent {
    readonly level: "error";
    readonly connectionId: string;
    readonly error: unknown;
    /**
     * The query that failed. Not set for errors outside of query execution, e.g. closing a connection.
     */
    readonly query?: CompiledQuery;
    readonly queryDurationMillis?: number;
}

export interface ConnectionLogEvent {
    readonly level: "connection";
    readonly connectionId: string;
    readonly action: "acquire" | "release";
    readonly durationMillis: number;
}

export interface TransactionLogEvent {
    readonly level: "transaction";
    readonly connectionId: string;
    readonly action: "begin" | "commit" | "rollback" | "savepoint" | "rollbackToSavepoint";
    readonly savepoint?: string;
    readonly durationMillis?: number;
}

export type OracleLogEvent = QueryLogEvent | ErrorLogEvent | ConnectionLogEvent | TransactionLogEvent;

export type OracleLogger = (event: OracleLogEvent) => void | Promise<void>;

export interface OracleLogOptions {
    /**
     * Levels to log.
     *
     * @default all levels
     */
    levels?: ReadonlyArray<OracleLogLevel>;
    /**
     * Function that receives the events for the enabled levels.
     *
     * @default a console logger
     */
    logger?: OracleLogger;
}

/**
 * Either a list of levels to log to the console, a function that receives every log event, or
 * an object with both.
 */
export type OracleLogConfig = ReadonlyArray<OracleLogLevel> | OracleLogger | OracleLogOptions;

type OracleLogEventOf<L extends OracleLogLevel> = Extract<OracleLogEvent, { level: L }>;

const resolveLogOptions = (config?: OracleLogConfig): Required<OracleLogOptions> => {
    if (config === undefined) {
        return { levels: [], logger: defaultLogger };
    }
    if (typeof config === "function") {
        return { levels: ORACLE_LOG_LEVELS, logger: config };
    }
    if (isLevelList(config)) {
        return { levels: config, logger: defaultLogger };
    }
    return { levels: config.levels ?? ORACLE_LOG_LEVELS, logger: config.logger ?? defaultLogger };
};

const isLevelList = (
    config: ReadonlyArray<OracleLogLevel> | OracleLogOptions,
): config is ReadonlyArray<OracleLogLevel> => Array.isArray(config);

export class OracleLog {
    readonly #levels: Readonly<Record<OracleLogLevel, boolean>>;
    readonly #logger: OracleLogger;

    constructor(config?: OracleLogConfig) {
        const { levels, logger } = resolveLogOptions(config);
        this.#logger = logger;
        this.#levels = Object.freeze({
            query: levels.includes("query"),
            error: levels.includes("error"),
            connection: levels.includes("connection"),
            transaction: levels.includes("transaction"),
        });
    }

    isLevelEnabled(level: OracleLogLevel): boolean {
        return this.#levels[level];
    }

    /**
     * Log an event. The event is only created if the level is enabled.
     */
    async log<L extends OracleLogLevel>(level: L, getEvent: () => OracleLogEventOf<L>): Promise<void> {
        if (this.#levels[level]) {
            await this.#logger(getEvent());
        }
    }
}

const PREFIX = "kysely-oracledb";

export const formatDuration = (durationMillis: number) => `${durationMillis.toFixed(1)}ms`;

/**
 * Format a log event as the message the default console logger prints, e.g.
 * `kysely-oracledb:query: select * from DUAL (1.2ms)`.
 */
export const formatLogEvent = (event: OracleLogEvent): string => {
    switch (event.level) {
        case "query":
            return `${PREFIX}:query: ${event.query.sql} (${formatDuration(event.queryDurationMillis)})`;
        case "error":
            if (event.error instanceof Error) {
                return `${PREFIX}:error: ${event.error.stack ?? event.error.message}`;
            }
            return `${PREFIX}:error: ${JSON.stringify({
                error: event.error,
                query: event.query?.sql,
                queryDurationMillis: event.queryDurationMillis,
            })}`;
        case "connection":
            return `${PREFIX}:connection: ${event.action} ${event.connectionId} (${formatDuration(event.durationMillis)})`;
        case "transaction": {
            const savepoint = event.savepoint ? ` ${event.savepoint}` : "";
            const duration = event.durationMillis !== undefined ? ` (${formatDuration(event.durationMillis)})` : "";
            return `${PREFIX}:transaction: ${event.action}${savepoint} ${event.connectionId}${duration}`;
        }
    }
};

const defaultLogger = (event: OracleLogEvent): void => {
    if (event.level === "error") {
        console.error(formatLogEvent(event));
    } else {
        console.log(formatLogEvent(event));
    }
};
