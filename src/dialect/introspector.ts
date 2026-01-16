import {
    DatabaseIntrospector,
    DatabaseMetadata,
    DatabaseMetadataOptions,
    Kysely,
    SchemaMetadata,
    Selectable,
    TableMetadata,
} from "kysely";
import { OracleDialectConfig } from "./dialect.js";

export interface AllUsersTable {
    USERNAME: string;
}

export interface AllTablesTable {
    OWNER: string;
    TABLE_NAME: string;
}

export interface AllViewsTable {
    OWNER: string;
    VIEW_NAME: string;
}

export interface AllTabColumnsTable {
    OWNER: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    DATA_TYPE: string;
    DATA_LENGTH: number | null;
    DATA_PRECISION: number | null;
    DATA_SCALE: number | null;
    NULLABLE: string;
    DATA_DEFAULT: string | null;
    IDENTITY_COLUMN: string;
}

export interface IntropsectorDB {
    ALL_USERS: Selectable<AllUsersTable>;
    ALL_TABLES: Selectable<AllTablesTable>;
    ALL_VIEWS: Selectable<AllViewsTable>;
    ALL_TAB_COLUMNS: Selectable<AllTabColumnsTable>;
}

export class OracleIntrospector implements DatabaseIntrospector {
    readonly #db: Kysely<IntropsectorDB>;
    readonly #config?: OracleDialectConfig;

    constructor(db: Kysely<IntropsectorDB>, config?: OracleDialectConfig) {
        this.#db = db;
        this.#config = config;
    }

    async getSchemas(): Promise<SchemaMetadata[]> {
        const rawSchemas = await this.#db
            .selectFrom("ALL_USERS")
            .select("USERNAME")
            .where((eb) =>
                eb.or([
                    eb(eb.val(this.#config?.generator?.schemas?.length ?? 0), "=", eb.val(0)),
                    eb("USERNAME", "in", this.#config?.generator?.schemas ?? [null]),
                ]),
            )
            .fetch(999) // Oracle has a limit of 999 parameters for the IN clause
            .execute();
        return rawSchemas.map((schema) => ({ name: schema.USERNAME }));
    }

    async getTables(_options?: DatabaseMetadataOptions): Promise<TableMetadata[]> {
        const schemas = (await this.getSchemas()).map((it) => it.name);
        const dualTable = { OWNER: "SYS", TABLE_NAME: "DUAL" };
        const rawTables = await this.#db
            .selectFrom("ALL_TABLES")
            .select(["OWNER", "TABLE_NAME"])
            .where("OWNER", "in", schemas)
            .where((eb) =>
                eb.or([
                    eb(eb.val(this.#config?.generator?.tables?.length ?? 0), "=", eb.val(0)),
                    eb("TABLE_NAME", "in", this.#config?.generator?.tables ?? [null]),
                ]),
            )
            .fetch(999) // Oracle has a limit of 999 parameters for the IN clause
            .execute();
        const hasDualTable = rawTables.some(
            (table) => table.OWNER === dualTable.OWNER && table.TABLE_NAME === dualTable.TABLE_NAME,
        );
        if (!hasDualTable) {
            rawTables.push(dualTable);
        }
        const rawColumns = await this.#db
            .selectFrom("ALL_TAB_COLUMNS")
            .select([
                "OWNER",
                "TABLE_NAME",
                "COLUMN_NAME",
                "DATA_TYPE",
                "DATA_LENGTH",
                "DATA_PRECISION",
                "DATA_SCALE",
                "NULLABLE",
                "DATA_DEFAULT",
                "IDENTITY_COLUMN",
            ])
            .where("OWNER", "in", [...schemas, dualTable.OWNER])
            .where(
                "TABLE_NAME",
                "in",
                rawTables.map((table) => table.TABLE_NAME),
            )
            .execute();
        const tables = rawTables.map((table) => {
            const columns = rawColumns
                .filter((col) => col.OWNER === table.OWNER && col.TABLE_NAME === table.TABLE_NAME)
                .map((col) => ({
                    name: col.COLUMN_NAME,
                    dataType: col.DATA_TYPE,
                    dataLength: col.DATA_LENGTH,
                    dataPrecision: col.DATA_PRECISION,
                    dataScale: col.DATA_SCALE,
                    isNullable: col.NULLABLE === "Y",
                    hasDefaultValue: col.DATA_DEFAULT !== null,
                    isAutoIncrementing: col.IDENTITY_COLUMN === "YES",
                }));

            return { schema: table.OWNER, name: table.TABLE_NAME, isView: false, columns };
        });
        return tables;
    }

    async getViews(_options?: DatabaseMetadataOptions): Promise<TableMetadata[]> {
        const schemas = (await this.getSchemas()).map((it) => it.name);
        const rawViews = await this.#db
            .selectFrom("ALL_VIEWS")
            .select(["OWNER", "VIEW_NAME"])
            .where("OWNER", "in", schemas)
            .where((eb) =>
                eb.or([
                    eb(eb.val(this.#config?.generator?.views?.length ?? 0), "=", eb.val(0)),
                    eb("VIEW_NAME", "in", this.#config?.generator?.views ?? [null]),
                ]),
            )
            .fetch(999) // Oracle has a limit of 999 parameters for the IN clause
            .execute();
        const rawColumns = await this.#db
            .selectFrom("ALL_TAB_COLUMNS")
            .select(["OWNER", "TABLE_NAME", "COLUMN_NAME", "DATA_TYPE", "NULLABLE", "DATA_DEFAULT", "IDENTITY_COLUMN"])
            .where("OWNER", "in", schemas)
            .where(
                "TABLE_NAME",
                "in",
                rawViews.map((view) => view.VIEW_NAME),
            )
            .execute();
        const views = rawViews.map((view) => {
            const columns = rawColumns
                .filter((col) => col.OWNER === view.OWNER && col.TABLE_NAME === view.VIEW_NAME)
                .map((col) => ({
                    name: col.COLUMN_NAME,
                    dataType: col.DATA_TYPE,
                    isNullable: col.NULLABLE === "Y",
                    hasDefaultValue: col.DATA_DEFAULT !== null,
                    isAutoIncrementing: col.IDENTITY_COLUMN === "YES",
                }));
            const viewName = view.OWNER === "SYS" ? view.VIEW_NAME.replace("_$", "$") : view.VIEW_NAME;
            return { schema: view.OWNER, name: viewName, isView: true, columns };
        });
        return views;
    }

    async getMetadata(_options?: DatabaseMetadataOptions): Promise<DatabaseMetadata> {
        return {
            tables: [...(await this.getTables()), ...(await this.getViews())],
        };
    }
}
