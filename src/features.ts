import oracledb from "oracledb";

export const isIntervalSupported = (): boolean => typeof oracledb.IntervalYM !== "undefined";
