import fs from "fs";
import { ColumnMetadata, Kysely, TableMetadata } from "kysely";
import path from "path";
import type { Options } from "prettier";
import { OracleDialect, OracleDialectConfig } from "../dialect/dialect.js";
import { IntropsectorDB } from "../dialect/introspector.js";
import { defaultLogger } from "../dialect/logger.js";
import { typeMap } from "./map.js";
import { camelCase, pascalCase } from "./utils.js";

interface TableTypes {
    table: string;
    tableTypeName: string;
    types: string;
}

const warningComment = `// This file was generated automatically. Please don't edit it manually!`;
const kyselyImport = `import type { Generated, Insertable, Selectable, Updateable } from 'kysely'`;
const kyselyImportNoGen = `import type { Insertable, Selectable, Updateable } from 'kysely'`;
const generationComment = (date: string) => `// Timestamp: ${date}`;

export const generateFieldTypes = (
    fields: ColumnMetadata[],
    useCamelCase = false,
    underscoreLeadingDigits = false,
): string => {
    const fieldStrings = fields.map((field) => {
        const type = typeMap[field.dataType];
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
        return {
            table: table.schema === "SYS" ? "'sys." + originalTableName + "'" : originalTableName,
            tableTypeName: pascalCaseTable,
            types: `${tableString}\n${selectString}\n${insertString}\n${updateString}`,
        };
    });
};

export const generateDatabaseTypes = (tableTypes: TableTypes[], hasGeneratedField = false): string => {
    const kyeslyImports = hasGeneratedField ? kyselyImport : kyselyImportNoGen;
    const tableTypesString = tableTypes.map(({ types }) => types).join("\n\n");
    const exportString = ["export interface DB {"];
    exportString.push(...tableTypes.map(({ table, tableTypeName }) => `${table}: ${tableTypeName}Table`), "}");
    const importString = `${warningComment}\n${generationComment(new Date().toISOString())}\n\n${kyeslyImports}`;
    return `${importString}\n\n${tableTypesString}\n\n${exportString.join("\n")}`;
};

export const formatTypes = async (types: string, options?: Options): Promise<string> => {
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
    config: OracleDialectConfig,
) => {
    writeToFile(types, filePath);
    if (config.generator?.metadata) {
        writeToFile(JSON.stringify(metadata, null, 2), metadataFilePath);
    }
};

export const generate = async (config: OracleDialectConfig) => {
    const log = config.logger ? config.logger : defaultLogger;
    const type = config.generator?.type ?? "tables";
    try {
        const dialect = new OracleDialect(config);
        const db = new Kysely<IntropsectorDB>({ dialect });
        const introspector = dialect.createIntrospector(db);

        let tables: TableMetadata[];

        switch (type) {
            case "tables":
                tables = await introspector.getTables();
                break;
            case "views":
                tables = await introspector.getViews();
                break;
            case "all":
                tables = [...(await introspector.getTables()), ...(await introspector.getViews())];
                break;
        }

        tables = tables.sort((a, b) => a.name.localeCompare(b.name));

        const hasGeneratedField = tables.some((table) => table.columns.some((column) => column.isAutoIncrementing));

        const tableTypes = generateTableTypes(
            tables,
            config.generator?.camelCase,
            config.generator?.underscoreLeadingDigits,
        );
        const databaseTypes = generateDatabaseTypes(tableTypes, hasGeneratedField);

        const formattedTypes = await formatTypes(databaseTypes, config?.generator?.prettierOptions);

        const filePath = config.generator?.filePath || path.join(process.cwd(), "types.ts");
        const metadataFilePath = config.generator?.metadataFilePath || path.join(process.cwd(), "tables.json");

        if (config.generator?.checkDiff) {
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
