import { Dialect, Kysely } from "kysely";
import { ExecuteOptions, Pool } from "oracledb";
import type { Options as PrettierOptions } from "prettier";
import { OracleAdapter } from "./adapter.js";
import { OracleDriver } from "./driver.js";
import { IntropsectorDB, OracleIntrospector } from "./introspector.js";
import { Logger } from "./logger.js";
import { OracleQueryCompiler } from "./query-compiler.js";

export interface OracleDialectConfig {
    pool: Pool;
    logger?: Logger;
    generator?: {
        /**
         * The type of generation to perform. Defaults to "tables".
         */
        type?: "tables" | "views" | "all";
        /**
         * List of schemas to include in the generation.
         *
         * If not provided, all schemas will be included.
         */
        schemas?: string[];
        /**
         * List of tables to include in the generation.
         *
         * If not provided, all tables will be included.
         */
        tables?: string[];
        /**
         * List of views to include in the generation.
         *
         * If not provided, all views will be included.
         */
        views?: string[];
        /**
         * Whether to use camelCase for generated types.
         *
         * Defaults to `false`.
         */
        camelCase?: boolean;
        /**
         * Whether to check for differences between the generated types and the existing types in the database.
         *
         * Defaults to `false`.
         */
        checkDiff?: boolean;
        /**
         * Whether to output table metadata as part of the generation.
         *
         * Defaults to `false`.
         */
        metadata?: boolean;
        /**
         * Whether to retain underscores in leading digits when converting to camelCase.
         *
         * Use this option if you want to preserve column and table names when not using the `underscoreBeforeDigits` option in the Kysely camelCase plugin.
         *
         * Defaults to `false`.
         */
        underscoreLeadingDigits?: boolean;
        /**
         * The file path to write the generated types to.
         *
         * Defaults to `types.ts` in the current working directory.
         */
        filePath?: string;
        /**
         * The file path to write the table metadata to.
         *
         * Defaults to `tables.json` in the current working directory.
         */
        metadataFilePath?: string;
        /**
         * Prettier options to format the generated types.
         */
        prettierOptions?: PrettierOptions;
    };
    executeOptions?: ExecuteOptions;
}

export class OracleDialect implements Dialect {
    readonly #config: OracleDialectConfig;

    constructor(config: OracleDialectConfig) {
        this.#config = config;
    }

    createDriver(): OracleDriver {
        return new OracleDriver(this.#config);
    }

    createAdapter(): OracleAdapter {
        return new OracleAdapter();
    }

    createIntrospector(db: Kysely<IntropsectorDB>): OracleIntrospector {
        return new OracleIntrospector(db, this.#config);
    }

    createQueryCompiler(): OracleQueryCompiler {
        return new OracleQueryCompiler();
    }
}
