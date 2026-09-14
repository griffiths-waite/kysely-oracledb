import fs from "fs";
import { ColumnMetadata, Kysely, TableMetadata } from "kysely";
import path from "path";
import type { Options as PrettierOptions } from "prettier";
import { OracleDialect, OracleDialectConfig } from "../dialect/dialect.js";
import { defaultLogger } from "../dialect/logger.js";
import { getTypeMapping, isIntervalSupported } from "./map.js";
import { camelCase, pascalCase } from "./utils.js";

interface TableTypes {
    table: string;
    tableTypeName: string;
    types: string;
}

const warningComment = `// This file was generated automatically. Please don't edit it manually!`;
const kyselyImport = `import type { Generated, Insertable, Selectable, Updateable } from 'kysely'`;
const kyselyImportNoGen = `import type { Insertable, Selectable, Updateable } from 'kysely'`;
const oracleYearMonthImport = `import type { IntervalYM } from 'oracledb'`;
const oracleDaySecondImport = `import type { IntervalDS } from 'oracledb'`;
const oracleIntervalImport = `import type { IntervalYM, IntervalDS } from 'oracledb'`;
const generationComment = (date: string) => `// Timestamp: ${date}`;

const hasFields = {
    generated: false,
    intervalYearMonth: false,
    intervalDaySecond: false,
};

export const generateFieldTypes = (
    fields: ColumnMetadata[],
    useCamelCase = false,
    underscoreLeadingDigits = false,
): string => {
    const fieldStrings = fields.map((field) => {
        if (field.isAutoIncrementing) {
            hasFields.generated = true;
        }
        if (isIntervalSupported && field.dataType.startsWith("INTERVAL YEAR")) {
            hasFields.intervalYearMonth = true;
        }
        if (isIntervalSupported && field.dataType.startsWith("INTERVAL DAY")) {
            hasFields.intervalDaySecond = true;
        }
        const type = getTypeMapping(field.dataType);
        if (!type) {
            throw new Error(`Unsupported data type: ${field.dataType}`);
        }
        const types = [type];
        if (field.isNullable) {
            types.push("null");
        }
        const typesString = field.isAutoIncrementing ? `Generated<${types.join(" | ")}>` : types.join(" | ");
        return `${useCamelCase ? `'${camelCase(field.name, underscoreLeadingDigits)}'` : `'${field.name}'`}: ${typesString}`;
    });
    return fieldStrings.join("\n");
};

export const generateTableTypes = (
    tables: TableMetadata[],
    useCamelCase = false,
    underscoreLeadingDigits = false,
): TableTypes[] => {
    return tables.map((table) => {
        const originalTableName = useCamelCase ? camelCase(table.name, underscoreLeadingDigits) : table.name;
        const pascalCaseTable = pascalCase(table.name, underscoreLeadingDigits);
        const tableString = `interface ${pascalCaseTable}Table {\n${generateFieldTypes(table.columns, useCamelCase, underscoreLeadingDigits)}\n}`;
        const selectString = `export type ${pascalCaseTable} = Selectable<${pascalCaseTable}Table>`;
        const insertString = `export type New${pascalCaseTable} = Insertable<${pascalCaseTable}Table>`;
        const updateString = `export type ${pascalCaseTable}Update = Updateable<${pascalCaseTable}Table>`;
        const sysPrefix = useCamelCase ? "sys." : "SYS.";
        return {
            table: table.schema === "SYS" ? "'" + sysPrefix + originalTableName + "'" : originalTableName,
            tableTypeName: pascalCaseTable,
            types: `${tableString}\n${selectString}\n${insertString}\n${updateString}`,
        };
    });
};

export const generateDatabaseTypes = (tableTypes: TableTypes[], includeFields: typeof hasFields): string => {
    const kyeslyImports = includeFields.generated ? kyselyImport : kyselyImportNoGen;
    const tableTypesString = tableTypes.map(({ types }) => types).join("\n\n");
    const exportString = ["export interface DB {"];
    exportString.push(...tableTypes.map(({ table, tableTypeName }) => `${table}: ${tableTypeName}Table`), "}");
    let importString = `${warningComment}\n${generationComment(new Date().toISOString())}\n\n${kyeslyImports}`;

    if (includeFields.intervalYearMonth && includeFields.intervalDaySecond) {
        importString = importString.concat(`\n${oracleIntervalImport}`);
    } else if (includeFields.intervalYearMonth) {
        importString = importString.concat(`\n${oracleYearMonthImport}`);
    } else if (includeFields.intervalDaySecond) {
        importString = importString.concat(`\n${oracleDaySecondImport}`);
    }

    return `${importString}\n\n${tableTypesString}\n\n${exportString.join("\n")}`;
};

export const formatTypes = async (types: string, options?: PrettierOptions): Promise<string> => {
    let prettier: typeof import("prettier");
    try {
        prettier = await import("prettier");
    } catch {
        throw new Error('Formatting generated types requires "prettier" to be installed.');
    }
    return await prettier.format(
        types,
        options || {
            parser: "typescript",
            singleQuote: true,
            trailingComma: "all",
            endOfLine: "auto",
            tabWidth: 4,
            printWidth: 120,
            semi: true,
        },
    );
};

export const writeToFile = (types: string, path: string) => {
    fs.writeFileSync(path, types);
};

export const readFromFile = (path: string) => {
    return fs.readFileSync(path, "utf8");
};

export const checkDiff = (existingContent: string, newContent: string) => {
    const existingLines = existingContent.split("\n").slice(2);
    const newLines = newContent.split("\n").slice(2);
    const diff = newLines.find((line, index) => line !== existingLines[index]);
    return !!diff || existingLines.length !== newLines.length;
};

const updateTypes = (
    types: string,
    filePath: string,
    metadata: TableMetadata[],
    metadataFilePath: string,
    config: GeneratorConfig,
) => {
    writeToFile(types, filePath);
    if (config.metadata) {
        writeToFile(JSON.stringify(metadata, null, 2), metadataFilePath);
    }
};

export interface GeneratorConfig extends OracleDialectConfig {
    /**
     * Use camelCase for generated types.
     *
     * @default false
     */
    camelCase?: boolean;
    /**
     * Underscore leading digits when using camelCase.
     *
     * @default false
     */
    underscoreLeadingDigits?: boolean;
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
     * Whether to check for differences between the generated types and the existing types in the database.
     *
     * Defaults to `false`.
     */
    checkDiff?: boolean;
    /**
     * Prettier options to format the generated types.
     */
    prettierOptions?: PrettierOptions;
}

export const generate = async (config: GeneratorConfig) => {
    const log = config.logger ? config.logger : defaultLogger;
    try {
        const db = new Kysely({ dialect: new OracleDialect(config) });

        let tables = await db.introspection.getTables();

        tables = tables.sort((a, b) => a.name.localeCompare(b.name));

        const tableTypes = generateTableTypes(tables, config.camelCase, config.underscoreLeadingDigits);
        const databaseTypes = generateDatabaseTypes(tableTypes, hasFields);

        const formattedTypes = await formatTypes(databaseTypes, config.prettierOptions);

        const filePath = config.filePath || path.join(process.cwd(), "types.ts");
        const metadataFilePath = config.metadataFilePath || path.join(process.cwd(), "tables.json");

        if (config.checkDiff) {
            let diff = true;

            try {
                const existingTypes = readFromFile(filePath);

                diff = checkDiff(existingTypes, formattedTypes);

                if (diff) {
                    log.warn("Types have changed. Updating types file...");
                }
            } catch (err) {
                log.warn("Types file not found. Creating a new one...");
            }

            if (diff) {
                updateTypes(formattedTypes, filePath, tables, metadataFilePath, config);

                log.info("Types updated successfully");
            } else {
                log.info("Types have not changed");
            }
        } else {
            updateTypes(formattedTypes, filePath, tables, metadataFilePath, config);

            log.info("Types updated successfully");
        }

        await db.destroy();
    } catch (err) {
        log.error({ err }, "Error generating types");
    }
};
