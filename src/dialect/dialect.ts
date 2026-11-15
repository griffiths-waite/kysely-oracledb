import { Dialect, Kysely } from "kysely";
import { ExecuteOptions, Pool } from "oracledb";
import { OracleAdapter } from "./adapter.js";
import { OracleDriver } from "./driver.js";
import { IntrospectorOptions, OracleIntrospector } from "./introspector.js";
import { Logger } from "./logger.js";
import { CompilerOptions, OracleQueryCompiler } from "./query-compiler.js";

export interface OracleDialectConfig {
    /**
     * Oracle connection pool.
     */
    pool: Pool;
    logger?: Logger;
    /**
     * Oracle execute options.
     */
    executeOptions?: ExecuteOptions;
    /**
     * Kysely query compiler options.
     */
    compilerOptions?: CompilerOptions;
    /**
     * Kysely introspector options.
     */
    introspectorOptions?: IntrospectorOptions;
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

    createIntrospector(db: Kysely<any>): OracleIntrospector {
        return new OracleIntrospector(db, this.#config.introspectorOptions);
    }

    createQueryCompiler(): OracleQueryCompiler {
        return new OracleQueryCompiler(this.#config.compilerOptions);
    }
}
