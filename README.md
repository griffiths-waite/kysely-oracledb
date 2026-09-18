# kysely-oracledb

[Kysely](https://github.com/koskimas/kysely) Dialect and Type Generator for [Oracle DB](https://github.com/oracle/node-oracledb).

## Installation

```bash
npm install kysely oracle-db kysely-oracledb
```

## Dialect Usage

Create a dialect with a connection pool, then pass it to the Kysely instance:

```typescript
import type { DB } from "./types.js";
import oracledb from "oracledb";
import { Kysely, type Generated } from "kysely";
import { OracleDialect } from "kysely-oracledb";

const pool = await oracledb.createPool({
    user: "username",
    password: "password",
    connectionString: "localhost:1521/FREEPDB1",
});

const dialect = new OracleDialect({
    pool,
});

const db = new kysely<DB>({ dialect });
```

You can now use Kysely to query your database:

```typescript
import { db } from "./database.js";

const items = await db
    .from("ITEMS")
    .select("ID", "NAME")
    .where("AMOUNT", ">", 10)
    .execute();

console.log(items);
```

Read the [type generation](#type-generation) section for information on generating types.

## Dialect Configuration

### `logger`

A logger instance to enable logging for queries, connections, transactions, and errors.

### `executeOptions`

Global execute options to pass to every Kysely query.

For example, to commit transactions without needing to wrap each query in a `db.transaction()`, you can pass the `autoCommit` option to the dialect:

```typescript
import oracledb from "oracledb";
import { OracleDialect } from "kysely-oracledb";

const pool = await oracledb.createPool({
    user: "username",
    password: "password",
    connectionString: "localhost:1521/FREEPDB1",
});

const dialect = new OracleDialect({
    pool,
    executeOptions: {
        autoCommit: true,
    },
});
```

### `compilerOptions`

Kysely compiler options. Currently the only option available is `useNonQuotedIdentifiers` which controls how the compiled SQL represents the names of objects. Queries use quoted identifiers by default.

### `introspectorOptions`

Kysely allows you to extract table, view, and schema metadata using the `Introspector` class. The Oracle dialect accepts additional introspection options to filter this metadata.

## Extending Kysely

Kysely doesn't support Oracle specific syntax. In these scenarios, you can extend Kysely using the sql template tag.

For example, to round a number column:

```typescript
import { db } from "./database.js";
import type { Expression } from "kysely";

const round = (number: Expression<number>, decimals: number) =>
    sql<number>`round(${number},${decimals})`;

const items = await db
    .from("ITEMS")
    .select("ID", round("AMOUNT", 1).as("AMOUNT"))
    .execute();
```

Read the [official documentation](https://kysely.dev/docs/recipes/extending-kysely) for more information on extending Kysely.

## Type Generation

To get the most out of Kysely, you need to define types for your database schema. You can define these manually or you can generate them using the `generate` function.

```typescript
import oracledb from "oracledb";
import { generate } from "kysely-oracledb";

const pool = await oracledb.createPool({
    user: "username",
    password: "password",
    connectionString: "localhost:1521/FREEPDB1",
});

await generate({
    pool,
    introspectorOptions: {
        type: "tables",
        tables: ["ITEMS"],
    },
});
```

This will generate a types file with the following structure:

```typescript
import type { Insertable, Selectable, Updateable, Generated } from "kysely";

interface ItemsTable {
    ID: Generated<number>;
    NAME: string;
    AMOUNT: number;
}

export type Items = Selectable<ItemsTable>;
export type NewItems = Insertable<ItemsTable>;
export type ItemsUpdate = Updateable<ItemsTable>;

export interface DB {
    ITEMS: ItemsTable;
}
```

## Generator Configuration

The generator can be configured with the same options as the dialect, plus the following additional options:

| Option                    | Type               | Description                                                             |
| ------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `camelCase`               | `boolean`          | Convert database table names and columns to camel case.                 |
| `checkDiff`               | `boolean`          | Check for differences against existing types before generating.         |
| `metadata`                | `boolean`          | Generate table metadata json file.                                      |
| `underscoreLeadingDigits` | `boolean`          | Retain underscores in leading digits when converting to camel case.     |
| `filePath`                | `string`           | File path to write the types to. Defaults to current working directory. |
| `metadataFilePath`        | `string`           | File path to write the metadata (json) to.                              |
| `prettierOptions`         | `prettier.Options` | Prettier options for formatting.                                        |

## Plugins

### `WithExecuteOptions`

This plugin allows you to modify the `executeOptions` for a specific query. This takes priority over global execute options set in the dialect.

```typescript
import { withExecuteOptions } from "kysely-oracledb";

await db
    .insertInto("ITEMS")
    .values({ NAME: "New item", amount: 9.99 })
    .withPlugin(withExecuteOptions({ autoCommit: true }))
    .execute();
```

## Contributing

Contributions are welcome! Please open an issue or a pull request on GitHub.
