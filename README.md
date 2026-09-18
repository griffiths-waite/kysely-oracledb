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
// This file was generated automatically. Please don't edit it manually!
// kysely-oracledb:8214f7e2928d5c6f

import type { Generated, Insertable, Selectable, Updateable } from "kysely";

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

### Change Detection

The generated types file contains a unique fingerprint `kysely-oracledb:<fingerprint>`. Subsequent type generation runs compare fingerprints to determine if there are any changes.

> Manual file edits are not detected when comparing changes, therefore the types should not be modified once generated.

The `changed` flag to indicates if there are any changes to the types. Metadata is always updated regardless of whether the types file is updated or not.

## Generator Configuration

The generator can be configured with the same options as the dialect, plus the following additional options:

### `camelCase`

Convert database table names and column names to camel case.

Default: `false`.

### `camelCaseOptions`

The same options used for the `CamelCasePlugin`. These options are used to detect columns whose camelized name can't be converted back safely.

For example, `ISO_2CHAR_CODE` is camelized to `iso2charCode`, but converts back to `ISO2CHAR_CODE` when `underscoreBeforeDigits` is disabled. If your schema also contains table columns with trailing digits then this creates a scenario where some columns can't be safely converted.

```typescript
await generate({
    pool,
    camelCase: true,
    camelCaseOptions: { underscoreBeforeDigits: false },
});

// Output: Unsafe columns detected with the current camelCase options: ISO_2CHAR_CODE (iso2charCode)
```

See [`CamelCaseOverridesPlugin`](#camelcaseoverridesplugin) for handling unsafe columns at runtime.

### `metadata`

Output the table metadata to a file.

Default: `false`.

### `filePath`

File path to write the types to. Can be an absolute path, or relative to the current working directory. missing directories are created.

```typescript
await generate({ pool, filePath: "./src/db/types.ts" });
```

Default: `types.ts`.

### `metadataFilePath`

File path to write the metadata to. Can be an absolute path, or relative to the current working directory. missing directories are created.

```typescript
await generate({
    pool,
    metadata: true,
    metadataFilePath: "./src/metadata/tables.json",
});
```

Default: `metadata.json`.

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

### `CamelCaseOverridesPlugin`

An extension to the `CamelCasePlugin` that accepts overrides for columns who's camelized name can't be converted back safely.

```typescript
import { CamelCaseOverridesPlugin } from "kysely-oracledb";

const db = new Kysely<DB>({
    dialect: new OracleDialect({ pool }),
    plugins: [
        new CamelCaseOverridesPlugin(
            { iso2charCode: "ISO_2CHAR_CODE" },
            { upperCase: true },
        ),
    ],
});
```

Each override maps the affected camelized property name to its real column (or table) name.

## Contributing

Contributions are welcome! Please open an issue or a pull request on GitHub.
