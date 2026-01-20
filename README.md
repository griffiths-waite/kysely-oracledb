# kysely-oracledb

[Kysely](https://github.com/koskimas/kysely) Dialect and Type Generator for [Oracle DB](https://github.com/oracle/node-oracledb).

## Installation

```bash
npm install kysely oracle-db kysely-oracledb
```

## Usage

### Oracle DB Dialect

To use the Dialect with Kysely, you will need to pass in an Oracle DB `Pool` to the `OracleDialect` constructor.

```typescript
// See the section below for more information on generating types.
import type { DB } from "./types.ts";

import oracledb from "oracledb";
import { Kysely } from "kysely";
import { OracleDialect } from "kysely-oracledb";

const db = new Kysely<DB>({
    dialect: new OracleDialect({
        pool: await oracledb.createPool({
            user: "user",
            password: "pass",
            connectionString: "connection-string",
        }),
    }),
});
```

You can now use the `db` instance to query your Oracle database.

```typescript
const users = await db
    .from("users")
    .select("id", "name")
    .where("id", 1)
    .execute();
```

For functions that are specific to Oracle DB, you can use the template tag to execute raw SQL. For example, to use the `ROUND` function:

```typescript
// See the section below for more information on generating types.
import type { DB } from "./types.ts";
import type { ExpressionWrapper } from "kysely";

const round = (
    number: ExpressionWrapper<DB, keyof DB, number>,
    decimals: number,
) => sql<number>`round(${number},${decimals})`;

const products = await db
    .from("products")
    .select("id", round("price", 2).as("price"))
    .execute();
```

### Dialect Configuration

The dialect can be configured by passing in the following options:

| Option            | Type                      | Description                          | Required |
| ----------------- | ------------------------- | ------------------------------------ | -------- |
| `pool`            | `oracledb.Pool`           | Oracle DB connection pool.           | Yes      |
| `logger`          | `Logger`                  | Logger instance for debug messages.  | No       |
| `executeOptions`  | `oracledb.ExecuteOptions` | Default options for `execute` calls. | No       |
| `compilerOptions` | `CompilerOptions`         | Configure query compiler behaviour.  | No       |

By default, queries will use `oracledb.OUT_FORMAT_OBJECT` to fetch rows as objects, and objects will use quoted identifiers.

If you prefer to use unquoted identifiers, you can set the `useNonQuotedIdentifiers` option to `true` in the compiler options.

If you want to convert columns and tables to use camel case, you can pass the `CamelCasePlugin` to Kysely:

```typescript
import type { DB } from "./types.ts";

import oracledb from "oracledb";
import { Kysely, CamelCasePlugin } from "kysely";
import { OracleDialect } from "kysely-oracledb";

const db = new Kysely<DB>({
    dialect: new OracleDialect({
        pool: await oracledb.createPool({
            user: "user",
            password: "pass",
            connectionString: "connection-string",
        }),
    }),
    plugins: [new CamelCasePlugin({ upperCase: true })],
});
```

### Type Generation

Kysely requires you to define the types for your database schema. You can define these manually or you can generate them using the `generate` function.

```typescript
import oracledb from "oracledb";
import { generate } from "kysely-oracledb";

await generate({
    pool: await oracledb.createPool({
        user: "user",
        password: "pass",
        connectionString: "connection-string",
    }),
});
```

This will generate a types file with the following structure:

```typescript
import type { Insertable, Selectable, Updateable } from "kysely";

interface UserTable {
    id: number;
    name: string;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface DB {
    user: UserTable;
}
```

### Generator Configuration

The generator can be configured with the same options as the dialect, plus the following additional options:

| Option                    | Type               | Description                                                         | Required |
| ------------------------- | ------------------ | ------------------------------------------------------------------- | -------- |
| `type`                    | `string`           | Type of generation to perform.                                      | No       |
| `schemas`                 | `string[]`         | List of schemas to scope type generation.                           | No       |
| `tables`                  | `string[]`         | List of tables to scope type generation.                            | No       |
| `views`                   | `string[]`         | List of views to scope type generation.                             | No       |
| `camelCase`               | `boolean`          | Convert database table names and columns to camel case.             | No       |
| `checkDiff`               | `boolean`          | Check for differences against existing types before generating.     | No       |
| `metadata`                | `boolean`          | Generate table metadata json file.                                  | No       |
| `underscoreLeadingDigits` | `boolean`          | Retain underscores in leading digits when converting to camel case. | No       |
| `filePath`                | `string`           | File path to write the types to.                                    | No       |
| `metadataFilePath`        | `string`           | File path to write the metadata (json) to.                          | No       |
| `prettierOptions`         | `prettier.Options` | Prettier options for formatting.                                    | No       |

By default only table types are generated. You can also generate view types by setting the `type` option to `"view"`, or both table and view types by setting the `type` option to `"all"`.

By default the types will be written to `types.ts` in the current working directory. You can change this with the `filePath` option:

```typescript
import path from "path";
import oracledb from "oracledb";
import { fileURLToPath } from "url";
import { generate } from "kysely-oracledb";

await generate({
    pool: await oracledb.createPool({
        user: "user",
        password: "pass",
        connectionString: "connection-string",
    }),
    generator: {
        filePath: path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "db-types.ts",
        ),
    },
});
```

### Plugins

There is a plugin available `withExecuteOptions` that allows you to modify `oracledb.ExecuteOptions` for specific queries:

```typescript
import { withExecuteOptions } from "kysely-oracledb";

const users = await db
    .from("users")
    .select("id", "name")
    .where("id", 1)
    .withPlugin(withExecuteOptions({ outFormat: oracledb.OUT_FORMAT_ARRAY }))
    .execute();
```

## Contributing

Contributions are welcome! Please open an issue or a pull request on GitHub.
