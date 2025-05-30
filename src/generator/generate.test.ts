import fs from "fs";
import oracledb from "oracledb";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockedWrite } from "../__mocks__/fs.js";
import {
    checkDiff,
    formatTypes,
    generate,
    generateDatabaseTypes,
    generateFieldTypes,
    generateTableTypes,
} from "./generate.js";

describe("generateFieldTypes", () => {
    it("should generate type string for single field", () => {
        expect(
            generateFieldTypes([
                {
                    name: "name",
                    dataType: "VARCHAR2",
                    isNullable: false,
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                },
            ]),
        ).toBe("'name': string");
    });
    it("should generate type string for multiple fields", () => {
        expect(
            generateFieldTypes([
                {
                    name: "first_name",
                    dataType: "VARCHAR2",
                    isNullable: false,
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                },
                {
                    name: "last_name",
                    dataType: "VARCHAR2",
                    isNullable: false,
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                },
            ]),
        ).toBe("'first_name': string\n'last_name': string");
    });
    it("should generate type string for nullable field", () => {
        expect(
            generateFieldTypes([
                {
                    name: "name",
                    dataType: "VARCHAR2",
                    isNullable: true,
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                },
            ]),
        ).toBe("'name': string | null");
    });
    it("should generate type string for identity field", () => {
        expect(
            generateFieldTypes([
                {
                    name: "id",
                    dataType: "NUMBER",
                    isNullable: false,
                    hasDefaultValue: false,
                    isAutoIncrementing: true,
                },
            ]),
        ).toBe("'id': Generated<number>");
    });
    it("should generate type for date", () => {
        expect(
            generateFieldTypes([
                {
                    name: "date",
                    dataType: "DATE",
                    isNullable: false,
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                },
            ]),
        ).toBe("'date': Date");
    });
    it("should generate type string for camel case field", () => {
        expect(
            generateFieldTypes(
                [
                    {
                        name: "first_name",
                        dataType: "VARCHAR2",
                        isNullable: false,
                        hasDefaultValue: false,
                        isAutoIncrementing: false,
                    },
                ],
                true,
            ),
        ).toBe("'firstName': string");
    });
    it("should throw error for unsupported data type", () => {
        expect(() =>
            generateFieldTypes([
                {
                    name: "name",
                    dataType: "UNSUPPORTED",
                    isNullable: false,
                    hasDefaultValue: false,
                    isAutoIncrementing: false,
                },
            ]),
        ).toThrowError("Unsupported data type: UNSUPPORTED");
    });
    it("should generate type string for underscored camel case field", () => {
        expect(
            generateFieldTypes(
                [
                    {
                        name: "first_2nd_third",
                        dataType: "VARCHAR2",
                        isNullable: false,
                        hasDefaultValue: false,
                        isAutoIncrementing: false,
                    },
                ],
                true,
                true,
            ),
        ).toBe("'first_2ndThird': string");
    });
});

describe("generate table types", () => {
    it("should generate table types for single table", () => {
        expect(
            generateTableTypes([
                {
                    name: "user",
                    isView: false,
                    columns: [
                        {
                            name: "id",
                            dataType: "NUMBER",
                            isNullable: false,
                            hasDefaultValue: false,
                            isAutoIncrementing: true,
                        },
                        {
                            name: "name",
                            dataType: "VARCHAR2",
                            isNullable: false,
                            hasDefaultValue: false,
                            isAutoIncrementing: false,
                        },
                    ],
                },
            ]),
        ).toEqual([
            {
                table: "user",
                tableTypeName: "User",
                types:
                    "interface UserTable {" +
                    "\n" +
                    "'id': Generated<number>" +
                    "\n" +
                    "'name': string" +
                    "\n" +
                    "}" +
                    "\n" +
                    "export type User = Selectable<UserTable>" +
                    "\n" +
                    "export type NewUser = Insertable<UserTable>" +
                    "\n" +
                    "export type UserUpdate = Updateable<UserTable>",
            },
        ]);
    });
    it("should generate table types for multiple tables", () => {
        expect(
            generateTableTypes([
                {
                    name: "user",
                    isView: false,
                    columns: [
                        {
                            name: "id",
                            dataType: "NUMBER",
                            isNullable: false,
                            hasDefaultValue: false,
                            isAutoIncrementing: true,
                        },
                        {
                            name: "name",
                            dataType: "VARCHAR2",
                            isNullable: false,
                            hasDefaultValue: false,
                            isAutoIncrementing: false,
                        },
                    ],
                },
                {
                    name: "product",
                    isView: false,
                    columns: [
                        {
                            name: "id",
                            dataType: "NUMBER",
                            isNullable: false,
                            hasDefaultValue: false,
                            isAutoIncrementing: true,
                        },
                        {
                            name: "product",
                            dataType: "VARCHAR2",
                            isNullable: false,
                            hasDefaultValue: false,
                            isAutoIncrementing: false,
                        },
                        {
                            name: "price",
                            dataType: "NUMBER",
                            isNullable: true,
                            hasDefaultValue: false,
                            isAutoIncrementing: false,
                        },
                    ],
                },
            ]),
        ).toEqual([
            {
                table: "user",
                tableTypeName: "User",
                types:
                    "interface UserTable {" +
                    "\n" +
                    "'id': Generated<number>" +
                    "\n" +
                    "'name': string" +
                    "\n" +
                    "}" +
                    "\n" +
                    "export type User = Selectable<UserTable>" +
                    "\n" +
                    "export type NewUser = Insertable<UserTable>" +
                    "\n" +
                    "export type UserUpdate = Updateable<UserTable>",
            },
            {
                table: "product",
                tableTypeName: "Product",
                types:
                    "interface ProductTable {" +
                    "\n" +
                    "'id': Generated<number>" +
                    "\n" +
                    "'product': string" +
                    "\n" +
                    "'price': number | null" +
                    "\n" +
                    "}" +
                    "\n" +
                    "export type Product = Selectable<ProductTable>" +
                    "\n" +
                    "export type NewProduct = Insertable<ProductTable>" +
                    "\n" +
                    "export type ProductUpdate = Updateable<ProductTable>",
            },
        ]);
    });
    it("should generate table types for single camel case table", () => {
        expect(
            generateTableTypes(
                [
                    {
                        name: "user_profile",
                        isView: false,
                        columns: [
                            {
                                name: "id",
                                dataType: "NUMBER",
                                isNullable: false,
                                hasDefaultValue: false,
                                isAutoIncrementing: true,
                            },
                            {
                                name: "name",
                                dataType: "VARCHAR2",
                                isNullable: false,
                                hasDefaultValue: false,
                                isAutoIncrementing: false,
                            },
                        ],
                    },
                ],
                true,
            ),
        ).toEqual([
            {
                table: "userProfile",
                tableTypeName: "UserProfile",
                types:
                    "interface UserProfileTable {" +
                    "\n" +
                    "'id': Generated<number>" +
                    "\n" +
                    "'name': string" +
                    "\n" +
                    "}" +
                    "\n" +
                    "export type UserProfile = Selectable<UserProfileTable>" +
                    "\n" +
                    "export type NewUserProfile = Insertable<UserProfileTable>" +
                    "\n" +
                    "export type UserProfileUpdate = Updateable<UserProfileTable>",
            },
        ]);
    });
    it("should generate table types for underscored camel case table", () => {
        expect(
            generateTableTypes(
                [
                    {
                        name: "user_1test_profile",
                        isView: false,
                        columns: [
                            {
                                name: "id",
                                dataType: "NUMBER",
                                isNullable: false,
                                hasDefaultValue: false,
                                isAutoIncrementing: true,
                            },
                            {
                                name: "name",
                                dataType: "VARCHAR2",
                                isNullable: false,
                                hasDefaultValue: false,
                                isAutoIncrementing: false,
                            },
                        ],
                    },
                ],
                true,
                true,
            ),
        ).toEqual([
            {
                table: "user_1testProfile",
                tableTypeName: "User_1testProfile",
                types:
                    "interface User_1testProfileTable {" +
                    "\n" +
                    "'id': Generated<number>" +
                    "\n" +
                    "'name': string" +
                    "\n" +
                    "}" +
                    "\n" +
                    "export type User_1testProfile = Selectable<User_1testProfileTable>" +
                    "\n" +
                    "export type NewUser_1testProfile = Insertable<User_1testProfileTable>" +
                    "\n" +
                    "export type User_1testProfileUpdate = Updateable<User_1testProfileTable>",
            },
        ]);
    });
});

describe("generateDatabaseTypes", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(Date.UTC(2025, 0, 1)));
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should generate database types for single table", () => {
        expect(generateDatabaseTypes([{ table: "user", tableTypeName: "User", types: "types string" }])).toBe(
            "// This file was generated automatically. Please don't edit it manually!" +
                "\n" +
                "// Timestamp: 2025-01-01T00:00:00.000Z" +
                "\n\n" +
                "import type { Insertable, Selectable, Updateable } from 'kysely'" +
                "\n\n" +
                "types string" +
                "\n\n" +
                "export interface DB {" +
                "\n" +
                "user: UserTable" +
                "\n" +
                "}",
        );
    });
    it("should generate database types for single table with generated field", () => {
        expect(generateDatabaseTypes([{ table: "user", tableTypeName: "User", types: "types string" }], true)).toBe(
            "// This file was generated automatically. Please don't edit it manually!" +
                "\n" +
                "// Timestamp: 2025-01-01T00:00:00.000Z" +
                "\n\n" +
                "import type { Generated, Insertable, Selectable, Updateable } from 'kysely'" +
                "\n\n" +
                "types string" +
                "\n\n" +
                "export interface DB {" +
                "\n" +
                "user: UserTable" +
                "\n" +
                "}",
        );
    });
});

describe("formatTypes", () => {
    it("should format types using default prettier options", async () => {
        const types = "interface UserTable { id: number; name: string } export type User = Selectable<UserTable>";
        expect(await formatTypes(types)).toBe(
            "interface UserTable {" +
                "\n" +
                "    id: number;" +
                "\n" +
                "    name: string;" +
                "\n" +
                "}" +
                "\n" +
                "export type User = Selectable<UserTable>;\n",
        );
    });
});

describe("checkDiff", () => {
    it("should return true if there is a diff", () => {
        expect(checkDiff("line1\nline2\nline3", "line1\nline2\nline4")).toBe(true);
    });
    it("should not return true if there is no diff", () => {
        expect(checkDiff("line1\nline2\nline3", "line1\nline2\nline3")).toBe(false);
    });
    it("should not return true if there is only a diff in line 1 or 2 (comments)", () => {
        expect(checkDiff("line1\nline2\nline3", "line1\nline3\nline3")).toBe(false);
    });
    it("should return true if there are > lines", () => {
        expect(checkDiff("line1\nline2\nline3", "line1\nline2\nline3\nline4")).toBe(true);
    });
    it("should return true if there are < lines", () => {
        expect(checkDiff("line1\nline2\nline3", "line1\nline2")).toBe(true);
    });
});

describe("generate", () => {
    vi.mock(import("../dialect/dialect"), () => {
        const OracleDialect = vi.fn();
        OracleDialect.prototype.createDriver = vi.fn();
        OracleDialect.prototype.createAdapter = vi.fn();
        OracleDialect.prototype.createQueryCompiler = vi.fn();
        OracleDialect.prototype.createIntrospector = vi.fn(() => {
            return {
                getTables: vi.fn(async () =>
                    Promise.resolve([
                        {
                            name: "DUAL",
                            isView: false,
                            columns: [
                                {
                                    owner: "SYS",
                                    tableName: "DUAL",
                                    columnName: "DUMMY",
                                    dataType: "VARCHAR2",
                                    nullable: "Y",
                                    dataDefault: null,
                                },
                            ],
                            schema: "SYS",
                        },
                    ]),
                ),
                getViews: vi.fn(async () =>
                    Promise.resolve([
                        {
                            name: "VIEW",
                            isView: true,
                            columns: [
                                {
                                    owner: "SYS",
                                    tableName: "VIEW",
                                    columnName: "DUMMY",
                                    dataType: "VARCHAR2",
                                    nullable: "Y",
                                    dataDefault: null,
                                },
                            ],
                            schema: "SYS",
                        },
                    ]),
                ),
            };
        });
        return { OracleDialect };
    });
    it("should generate types and write to file", async () => {
        const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "types.ts");
        await generate({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
            generator: {
                schemas: ["SYS"],
                tables: ["DUAL"],
                checkDiff: true,
                filePath: filePath,
            },
        });
        expect(mockedWrite).toHaveBeenCalledTimes(1);
    });
    it("should generate types when checkDiff is false", async () => {
        vi.spyOn(fs, "writeFileSync").mockReturnValue();

        await generate({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
            generator: {
                schemas: ["SYS"],
                tables: ["DUAL"],
                checkDiff: false,
            },
        });

        expect(fs.writeFileSync).toHaveBeenCalled();
    });
    it("should generate types for a single table", async () => {
        vi.spyOn(fs, "writeFileSync").mockReturnValue();

        await generate({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
            generator: {
                schemas: ["SYS"],
                tables: ["DUAL"],
                checkDiff: true,
            },
        });

        expect(fs.writeFileSync).toHaveBeenCalled();
    });
    it("should generate types for a single view", async () => {
        vi.spyOn(fs, "writeFileSync").mockReturnValue();

        await generate({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
            generator: {
                type: "views",
                schemas: ["SYS"],
                views: ["VIEW"],
                checkDiff: true,
            },
        });

        expect(fs.writeFileSync).toHaveBeenCalled();
    });
    it("should generate types for tables and views", async () => {
        vi.spyOn(fs, "writeFileSync").mockReturnValue();

        await generate({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
            generator: {
                type: "all",
                schemas: ["SYS"],
                tables: ["DUAL"],
                views: ["VIEW"],
                checkDiff: true,
            },
        });

        expect(fs.writeFileSync).toHaveBeenCalled();
    });
    it("should accept a logger as a config option", async () => {
        vi.spyOn(fs, "writeFileSync").mockReturnValue();

        const logger = {
            fatal: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            trace: vi.fn(),
        };

        await generate({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
            logger,
            generator: {
                schemas: ["SYS"],
                tables: ["DUAL"],
                checkDiff: true,
            },
        });

        expect(logger.info).toHaveBeenCalled();
    });
    it("should generate metadata and write to file", async () => {
        const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "types.ts");
        const metadataFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "tables.json");
        await generate({
            pool: await oracledb.createPool({
                user: process.env.DB_USER,
            }),
            generator: {
                schemas: ["SYS"],
                tables: ["DUAL"],
                checkDiff: true,
                metadata: true,
                filePath,
                metadataFilePath,
            },
        });
        expect(mockedWrite).toHaveBeenCalledTimes(2);
    });
});
