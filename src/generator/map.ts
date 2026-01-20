import oracledb from "oracledb";

export const isIntervalSupported = typeof oracledb.IntervalYM !== "undefined";

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

export const getTypeMapping = (dataType: string) => {
    if (typeMap[dataType]) {
        return typeMap[dataType];
    }

    if (dataType.startsWith("TIMESTAMP")) {
        return "Date";
    }

    if (dataType.startsWith("INTERVAL YEAR")) {
        return isIntervalSupported ? "IntervalYM" : "unknown";
    }

    if (dataType.startsWith("INTERVAL DAY")) {
        return isIntervalSupported ? "IntervalDS" : "unknown";
    }

    return "unknown";
};
