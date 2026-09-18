import { ColumnMetadata } from "kysely";

export interface TypeImport {
    module: string;
    name: string;
}

export interface MappedType {
    text: string;
    imports: TypeImport[];
}

export interface TypeMappingOptions {
    intervalSupport: boolean;
}

const typeMap: Record<string, string> = {
    BFILE: "string",
    BINARY_DOUBLE: "number",
    BINARY_FLOAT: "number",
    BINARY_INTEGER: "number",
    BLOB: "string",
    "PL/SQL BOOLEAN": "boolean",
    CHAR: "string",
    CLOB: "string",
    SYS_REFCURSOR: "string",
    DATE: "Date",
    FLOAT: "number",
    JSON: "string",
    LONG: "string",
    "LONG RAW": "string",
    NCHAR: "string",
    NCLOB: "string",
    NUMBER: "number",
    NVARCHAR2: "string",
    OBJECT: "string",
    RAW: "string",
    ROWID: "string",
    TIMESTAMP: "Date",
    VARCHAR2: "string",
    XMLTYPE: "string",
    VECTOR: "string",
};

const mapDataType = (dataType: string, options: TypeMappingOptions): MappedType => {
    if (typeMap[dataType]) {
        return { text: typeMap[dataType], imports: [] };
    }

    if (dataType.startsWith("TIMESTAMP")) {
        return { text: "Date", imports: [] };
    }

    if (dataType.startsWith("INTERVAL YEAR")) {
        return options.intervalSupport
            ? { text: "IntervalYM", imports: [{ module: "oracledb", name: "IntervalYM" }] }
            : { text: "unknown", imports: [] };
    }

    if (dataType.startsWith("INTERVAL DAY")) {
        return options.intervalSupport
            ? { text: "IntervalDS", imports: [{ module: "oracledb", name: "IntervalDS" }] }
            : { text: "unknown", imports: [] };
    }

    return { text: "unknown", imports: [] };
};

export const mapColumnType = (column: ColumnMetadata, options: TypeMappingOptions): MappedType => {
    const base = mapDataType(column.dataType, options);
    const text = column.isNullable ? `${base.text} | null` : base.text;

    if (column.isAutoIncrementing) {
        return { text: `Generated<${text}>`, imports: [...base.imports, { module: "kysely", name: "Generated" }] };
    }

    if (column.hasDefaultValue) {
        return {
            text: `ColumnType<${text}, ${text} | undefined, ${text}>`,
            imports: [...base.imports, { module: "kysely", name: "ColumnType" }],
        };
    }

    return { text, imports: base.imports };
};
