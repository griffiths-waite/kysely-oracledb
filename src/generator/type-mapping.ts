import { ColumnMetadata } from "kysely";
import oracledb from "oracledb";

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

const plain = (text: string): MappedType => ({ text, imports: [] });

const typeMap = new Map<string, MappedType>([
    [oracledb.DB_TYPE_VARCHAR.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_NVARCHAR.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_CHAR.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_NCHAR.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_LONG.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_CLOB.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_NCLOB.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_ROWID.columnTypeName, plain("string")],
    [oracledb.DB_TYPE_XMLTYPE.columnTypeName, plain("string")],
    ["UROWID", plain("string")],

    [oracledb.DB_TYPE_NUMBER.columnTypeName, plain("number")],
    [oracledb.DB_TYPE_BINARY_FLOAT.columnTypeName, plain("number")],
    [oracledb.DB_TYPE_BINARY_DOUBLE.columnTypeName, plain("number")],
    ["FLOAT", plain("number")],

    [oracledb.DB_TYPE_BOOLEAN.columnTypeName, plain("boolean")],

    [oracledb.DB_TYPE_DATE.columnTypeName, plain("Date")],
    [oracledb.DB_TYPE_TIMESTAMP.columnTypeName, plain("Date")],
    [oracledb.DB_TYPE_TIMESTAMP_TZ.columnTypeName, plain("Date")],
    [oracledb.DB_TYPE_TIMESTAMP_LTZ.columnTypeName, plain("Date")],

    [oracledb.DB_TYPE_BLOB.columnTypeName, plain("Buffer")],
    [oracledb.DB_TYPE_RAW.columnTypeName, plain("Buffer")],
    [oracledb.DB_TYPE_LONG_RAW.columnTypeName, plain("Buffer")],

    [oracledb.DB_TYPE_VECTOR.columnTypeName, plain("Float32Array | Float64Array | Int8Array | Uint8Array")],
]);

const stripParameters = (dataType: string): string => dataType.replace(/\(\s*\d+\s*(?:,\s*\d+\s*)?\)/g, "");

const mapDataType = (dataType: string, options: TypeMappingOptions): MappedType => {
    const name = stripParameters(dataType);

    const mapped = typeMap.get(name);

    if (mapped) {
        return mapped;
    }

    if (options.intervalSupport) {
        if (name === oracledb.DB_TYPE_INTERVAL_YM.columnTypeName) {
            return { text: "IntervalYM", imports: [{ module: "oracledb", name: "IntervalYM" }] };
        }

        if (name === oracledb.DB_TYPE_INTERVAL_DS.columnTypeName) {
            return { text: "IntervalDS", imports: [{ module: "oracledb", name: "IntervalDS" }] };
        }
    }

    return plain("unknown");
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
