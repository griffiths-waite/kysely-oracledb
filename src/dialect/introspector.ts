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
    username: string;
}

export interface AllTablesTable {
    owner: string;
    table_name: string;
}

export interface AllViewsTable {
    owner: string;
    view_name: string;
}

export interface AllTabColumnsTable {
    owner: string;
    table_name: string;
    column_name: string;
    data_type: string;
    data_length: number | null;
    data_precision: number | null;
    data_scale: number | null;
    nullable: string;
    data_default: string | null;
    identity_column: string;
}

export interface IntropsectorDB {
    all_users: Selectable<AllUsersTable>;
    all_tables: Selectable<AllTablesTable>;
    all_views: Selectable<AllViewsTable>;
    all_tab_columns: Selectable<AllTabColumnsTable>;
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
            .selectFrom("all_users")
            .select("username")
            .where((eb) =>
                eb.or([
                    eb(eb.val(this.#config?.generator?.schemas?.length ?? 0), "=", eb.val(0)),
                    eb("username", "in", this.#config?.generator?.schemas ?? [null]),
                ]),
            )
            .fetch(999) // Oracle has a limit of 999 parameters for the IN clause
            .execute();
        return rawSchemas.map((schema) => ({ name: schema.username }));
    }

    async getTables(_options?: DatabaseMetadataOptions): Promise<TableMetadata[]> {
        const schemas = (await this.getSchemas()).map((it) => it.name);
        const dualTable = { owner: "SYS", table_name: "DUAL" };
        const rawTables = await this.#db
            .selectFrom("all_tables")
            .select(["owner", "table_name"])
            .where("owner", "in", schemas)
            .where((eb) =>
                eb.or([
                    eb(eb.val(this.#config?.generator?.tables?.length ?? 0), "=", eb.val(0)),
                    eb("table_name", "in", this.#config?.generator?.tables ?? [null]),
                ]),
            )
            .fetch(999) // Oracle has a limit of 999 parameters for the IN clause
            .execute();
        const hasDualTable = rawTables.some(
            (table) => table.owner === dualTable.owner && table.table_name === dualTable.table_name,
        );
        if (!hasDualTable) {
            rawTables.push(dualTable);
        }
        const rawColumns = await this.#db
            .selectFrom("all_tab_columns")
            .select([
                "owner",
                "table_name",
                "column_name",
                "data_type",
                "data_length",
                "data_precision",
                "data_scale",
                "nullable",
                "data_default",
                "identity_column",
            ])
            .where("owner", "in", [...schemas, dualTable.owner])
            .where(
                "table_name",
                "in",
                rawTables.map((table) => table.table_name),
            )
            .execute();
        const tables = rawTables.map((table) => {
            const columns = rawColumns
                .filter((col) => col.owner === table.owner && col.table_name === table.table_name)
                .map((col) => ({
                    name: col.column_name,
                    dataType: col.data_type,
                    dataLength: col.data_length,
                    dataPrecision: col.data_precision,
                    dataScale: col.data_scale,
                    isNullable: col.nullable === "Y",
                    hasDefaultValue: col.data_default !== null,
                    isAutoIncrementing: col.identity_column === "YES",
                }));

            return { schema: table.owner, name: table.table_name, isView: false, columns };
        });
        return tables;
    }

    async getViews(_options?: DatabaseMetadataOptions): Promise<TableMetadata[]> {
        const schemas = (await this.getSchemas()).map((it) => it.name);
        const rawViews = await this.#db
            .selectFrom("all_views")
            .select(["owner", "view_name as viewName"])
            .where("owner", "in", schemas)
            .where((eb) =>
                eb.or([
                    eb(eb.val(this.#config?.generator?.views?.length ?? 0), "=", eb.val(0)),
                    eb("view_name", "in", this.#config?.generator?.views ?? [null]),
                ]),
            )
            .fetch(999) // Oracle has a limit of 999 parameters for the IN clause
            .execute();
        const rawColumns = await this.#db
            .selectFrom("all_tab_columns")
            .select([
                "owner",
                "table_name as tableName",
                "column_name as columnName",
                "data_type as dataType",
                "nullable",
                "data_default as dataDefault",
                "identity_column as identityColumn",
            ])
            .where("owner", "in", schemas)
            .where(
                "table_name",
                "in",
                rawViews.map((view) => view.viewName),
            )
            .execute();
        const views = rawViews.map((view) => {
            const columns = rawColumns
                .filter((col) => col.owner === view.owner && col.tableName === view.viewName)
                .map((col) => ({
                    name: col.columnName,
                    dataType: col.dataType,
                    isNullable: col.nullable === "Y",
                    hasDefaultValue: col.dataDefault !== null,
                    isAutoIncrementing: col.identityColumn === "YES",
                }));
            const viewName = view.owner === "SYS" ? view.viewName.replace("_$", "$") : view.viewName;
            return { schema: view.owner, name: viewName, isView: true, columns };
        });
        return views;
    }

    async getMetadata(_options?: DatabaseMetadataOptions): Promise<DatabaseMetadata> {
        return {
            tables: [...(await this.getTables()), ...(await this.getViews())],
        };
    }
}
