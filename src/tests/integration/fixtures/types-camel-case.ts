import type { ColumnType, Generated } from "kysely";

export interface ItemsTable {
    id: Generated<number>;
    name: string;
    code: ColumnType<string, string | undefined, string>;
    amount: number | null;
    notes: string | null;
    createdAt: ColumnType<Date, Date | undefined, Date>;
    updatedAt: Date | null;
}

export interface TagsTable {
    id: Generated<number>;
    name: string;
}

export interface ItemTagsTable {
    itemId: number;
    tagId: number;
}

export interface DB {
    items: ItemsTable;
    tags: TagsTable;
    itemTags: ItemTagsTable;
}
