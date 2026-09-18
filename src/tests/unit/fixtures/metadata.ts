import { ColumnMetadata, TableMetadata } from "kysely";

export const column = (name: string, dataType: string, overrides: Partial<ColumnMetadata> = {}): ColumnMetadata => ({
    name,
    dataType,
    isNullable: false,
    isAutoIncrementing: false,
    hasDefaultValue: false,
    ...overrides,
});

export const table = (
    name: string,
    columns: ColumnMetadata[],
    overrides: Partial<TableMetadata> = {},
): TableMetadata => ({
    name,
    schema: "TEST",
    isView: false,
    isForeign: false,
    columns,
    ...overrides,
});
