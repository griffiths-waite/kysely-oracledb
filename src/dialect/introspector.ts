import {
    ColumnMetadata,
    DatabaseIntrospector,
    DatabaseMetadataOptions,
    Kysely,
    SchemaMetadata,
    TableMetadata,
} from "kysely";
import { DEFAULT_MIGRATION_LOCK_TABLE, DEFAULT_MIGRATION_TABLE } from "kysely/migration";

export interface IntrospectorOptions {
    /**
     * Filter by object type.
     */
    type?: "tables" | "views";
    /**
     * Filter by schema name.
     */
    schemas?: string[];
    /**
     * Filter by table name.
     */
    tables?: string[];
    /**
     * Filter by view name.
     */
    views?: string[];
}

export interface OracleColumnMetadata extends ColumnMetadata {
    dataLength: number | null;
    dataPrecision: number | null;
    dataScale: number | null;
}

export interface OracleTableMetadata extends TableMetadata {
    columns: OracleColumnMetadata[];
}

export class OracleIntrospector implements DatabaseIntrospector {
    readonly #db: Kysely<IntropsectorDB>;
    readonly #options: IntrospectorOptions;

    constructor(db: Kysely<any>, options: IntrospectorOptions = {}) {
        this.#db = db;
        this.#options = options;
    }

    async getSchemas(): Promise<SchemaMetadata[]> {
        const schemaFilter = this.#options.schemas ?? [];

        const schemas = await this.#db
            .selectFrom("ALL_USERS")
            .select("USERNAME as name")
            .$if(schemaFilter.length > 0, (qb) => qb.where("USERNAME", "in", schemaFilter))
            .execute();

        return schemas;
    }

    async getTables(options: DatabaseMetadataOptions): Promise<OracleTableMetadata[]> {
        const schemaFilter = this.#options.schemas ?? [];
        const tableFilter = this.#options.tables ?? [];
        const viewFilter = this.#options.views ?? [];
        const typeFilter = this.#options.type;

        const tablesQuery = this.#db
            .selectFrom("ALL_TABLES as tables")
            .innerJoin("ALL_TAB_COLUMNS as columns", (join) =>
                join.onRef("columns.TABLE_NAME", "=", "tables.TABLE_NAME").onRef("columns.OWNER", "=", "tables.OWNER"),
            )
            .$if(schemaFilter.length > 0, (qb) => qb.where("tables.OWNER", "in", schemaFilter))
            .$if(tableFilter.length > 0, (qb) => qb.where("tables.TABLE_NAME", "in", tableFilter))
            .$if(!options.withInternalKyselyTables, (qb) =>
                qb
                    .where("tables.TABLE_NAME", "!=", DEFAULT_MIGRATION_TABLE)
                    .where("tables.TABLE_NAME", "!=", DEFAULT_MIGRATION_LOCK_TABLE),
            )
            .select((eb) => [
                "tables.OWNER as schema",
                "tables.TABLE_NAME as tableName",
                eb.val("table").$castTo<"table" | "view">().as("tableType"),
                "columns.COLUMN_NAME as columnName",
                "columns.DATA_TYPE as dataType",
                "columns.DATA_LENGTH as dataLength",
                "columns.DATA_PRECISION as dataPrecision",
                "columns.DATA_SCALE as dataScale",
                "columns.NULLABLE as isNullable",
                "columns.DATA_DEFAULT as dataDefault",
                "columns.IDENTITY_COLUMN as identityColumn",
            ]);

        const viewsQuery = this.#db
            .selectFrom("ALL_VIEWS as views")
            .innerJoin("ALL_TAB_COLUMNS as columns", (join) =>
                join.onRef("columns.TABLE_NAME", "=", "views.VIEW_NAME").onRef("columns.OWNER", "=", "views.OWNER"),
            )
            .$if(schemaFilter.length > 0, (qb) => qb.where("views.OWNER", "in", schemaFilter))
            .$if(viewFilter.length > 0, (qb) => qb.where("views.VIEW_NAME", "in", viewFilter))
            .select((eb) => [
                "views.OWNER as schema",
                "views.VIEW_NAME as tableName",
                eb.val("view").$castTo<"table" | "view">().as("tableType"),
                "columns.COLUMN_NAME as columnName",
                "columns.DATA_TYPE as dataType",
                "columns.DATA_LENGTH as dataLength",
                "columns.DATA_PRECISION as dataPrecision",
                "columns.DATA_SCALE as dataScale",
                "columns.NULLABLE as isNullable",
                "columns.DATA_DEFAULT as dataDefault",
                "columns.IDENTITY_COLUMN as identityColumn",
            ]);

        const pickQuery = () => {
            switch (typeFilter) {
                case "tables":
                    return tablesQuery;
                case "views":
                    return viewsQuery;
                default:
                    return tablesQuery.unionAll(viewsQuery);
            }
        };

        const columns = await pickQuery().execute();

        const tablesMap = new Map<string, OracleTableMetadata>();

        for (const column of columns) {
            const tableKey = `${column.schema}.${column.tableName}`;

            if (!tablesMap.has(tableKey)) {
                tablesMap.set(tableKey, {
                    schema: column.schema,
                    name: column.tableName,
                    isView: column.tableType === "view",
                    isForeign: false,
                    columns: [],
                });
            }

            const table = tablesMap.get(tableKey);

            if (table) {
                table.columns.push({
                    name: column.columnName,
                    dataType: column.dataType,
                    dataLength: column.dataLength,
                    dataPrecision: column.dataPrecision,
                    dataScale: column.dataScale,
                    isNullable: column.isNullable === "Y",
                    hasDefaultValue: column.dataDefault !== null,
                    isAutoIncrementing: column.identityColumn === "YES",
                });
            }
        }

        return Array.from(tablesMap.values());
    }
}

interface IntropsectorDB {
    ALL_USERS: {
        USERNAME: string;
    };
    ALL_TABLES: {
        OWNER: string;
        TABLE_NAME: string;
    };
    ALL_VIEWS: {
        OWNER: string;
        VIEW_NAME: string;
    };
    ALL_TAB_COLUMNS: {
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
    };
}
