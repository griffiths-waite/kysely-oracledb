import fs from "fs";
import { CamelCasePluginOptions, Kysely, TableMetadata } from "kysely";
import path from "path";
import { isDeepStrictEqual } from "util";
import { OracleDialect, OracleDialectConfig } from "../dialect/dialect.js";
import { defaultLogger } from "../dialect/logger.js";
import { isIntervalSupported } from "../features.js";
import { isConversionSafe } from "./camel-case.js";
import { toFieldName } from "./naming.js";
import { readFingerprint, renderTypes } from "./render.js";

export interface GenerateTypesOptions {
    /**
     * Use camelCase for generated types.
     *
     * @default false
     */
    camelCase?: boolean;
}

export interface GeneratorConfig extends OracleDialectConfig, GenerateTypesOptions {
    /**
     * Output the raw database table metadata.
     *
     * @default false
     */
    metadata?: boolean;
    /**
     * File path to write the generated types to.
     *
     * @default "types.ts"
     */
    filePath?: string;
    /**
     * File path to write the table metadata to.
     *
     * @default "tables.json"
     */
    metadataFilePath?: string;
    /**
     * Options for the `CamelCasePlugin`. Used to detect columns whose camelCase name can't be
     * converted back algorithmically. See `CamelCaseOverridesPlugin` for handling unsafe columns.
     *
     * @default {}
     */
    camelCaseOptions?: CamelCasePluginOptions;
    /**
     * Write the generated files. When disabled, files are only compared to detect changes.
     *
     * @default true
     */
    write?: boolean;
}

export interface GenerateResult {
    types: string;
    metadata: TableMetadata[];
    changed: boolean;
    metadataChanged: boolean;
}

const DEFAULT_TYPES_FILE = "types.ts";
const DEFAULT_METADATA_FILE = "tables.json";

const readFile = (filePath: string): string | undefined => {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch {
        return undefined;
    }
};

const writeFile = (filePath: string, file: string): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file);
};

const compareMetadata = (filePath: string, metadata: TableMetadata[]): boolean => {
    const existing = readFile(filePath);

    if (existing === undefined) {
        return true;
    }

    try {
        return !isDeepStrictEqual(JSON.parse(existing), JSON.parse(JSON.stringify(metadata)));
    } catch {
        return true;
    }
};

const introspect = async (config: GeneratorConfig): Promise<TableMetadata[]> => {
    const db = new Kysely({ dialect: new OracleDialect(config) });

    try {
        return await db.introspection.getTables();
    } finally {
        await db.destroy();
    }
};

/**
 * Generate types from table metadata. This is the same as `generate()` but without introspection
 * or file output.
 */
export const generateTypes = (tables: TableMetadata[], options: GenerateTypesOptions = {}): string =>
    renderTypes(tables, {
        camelCase: options.camelCase ?? false,
        intervalSupport: isIntervalSupported(),
    });

/**
 * Find columns whose camelCase name can't be converted back algorithmically.
 */
export const findUnsafeColumns = (tables: TableMetadata[], options: CamelCasePluginOptions): string[] =>
    tables.flatMap((table) =>
        table.columns
            .filter((column) => !isConversionSafe(column.name, toFieldName(column.name, { camelCase: true }), options))
            .map((column) => `${column.name} (${toFieldName(column.name, { camelCase: true })})`),
    );

/**
 * Generate types using database introspection.
 */
export const generate = async (config: GeneratorConfig): Promise<GenerateResult> => {
    const log = config.logger ?? defaultLogger;
    const write = config.write ?? true;

    const typesFilePath = path.resolve(config.filePath ?? DEFAULT_TYPES_FILE);
    const metadataFilePath = path.resolve(config.metadataFilePath ?? DEFAULT_METADATA_FILE);

    const metadata = await introspect(config);

    metadata.sort((a, b) => a.name.localeCompare(b.name));

    const oldTypes = readFile(typesFilePath);
    const newTypes = generateTypes(metadata, config);

    if (config.camelCase) {
        const unsafeColumns = findUnsafeColumns(metadata, config.camelCaseOptions ?? {});

        if (unsafeColumns.length > 0) {
            log.warn(`Unsafe columns detected with the current camelCase options: ${unsafeColumns.join(", ")}`);
        }
    }

    const typesChanged = readFingerprint(oldTypes) !== readFingerprint(newTypes);
    const metadataChanged = config.metadata ? compareMetadata(metadataFilePath, metadata) : false;

    if (write && typesChanged) {
        writeFile(typesFilePath, newTypes);
    }

    if (write && metadataChanged) {
        writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));
    }

    if (write) {
        log.info(
            [
                typesChanged ? "Types generated successfully" : "Types have not changed",
                `tables: ${metadata.length}`,
                `types: ${typesChanged ? typesFilePath : "skipped"}`,
                ...(config.metadata ? [`metadata: ${metadataChanged ? metadataFilePath : "skipped"}`] : []),
            ].join(", "),
        );
    } else {
        log.info(
            [
                typesChanged || metadataChanged ? "Generated files are out of date" : "Generated files are up to date",
                `tables: ${metadata.length}`,
                `types: ${typesChanged ? "changed" : "unchanged"}`,
                ...(config.metadata ? [`metadata: ${metadataChanged ? "changed" : "unchanged"}`] : []),
            ].join(", "),
        );
    }

    return { types: newTypes, metadata, changed: typesChanged, metadataChanged };
};
