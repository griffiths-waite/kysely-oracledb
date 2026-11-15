import type { ColumnType, Generated } from "kysely";

export interface ItemsTable {
    ID: Generated<number>;
    NAME: string;
    CODE: ColumnType<string, string | undefined, string>;
    AMOUNT: number | null;
    NOTES: string | null;
    CREATED_AT: ColumnType<Date, Date | undefined, Date>;
    UPDATED_AT: Date | null;
}

export interface TagsTable {
    ID: Generated<number>;
    NAME: string;
}

export interface ItemTagsTable {
    ITEM_ID: number;
    TAG_ID: number;
}

export interface DB {
    ITEMS: ItemsTable;
    TAGS: TagsTable;
    ITEM_TAGS: ItemTagsTable;
}
