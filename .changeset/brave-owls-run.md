---
"kysely-oracledb": minor
---

Added a `kysely-oracledb` CLI for generating types without writing a script, e.g. `npx kysely-oracledb generate --env-file .env -o src/db/types.ts`. It supports all generator options, connection details via flags or `ORACLE_USER` / `ORACLE_PASSWORD` / `ORACLE_CONNECT_STRING` environment variables, node-oracledb thick mode, and a `--check` mode for CI that exits with code `1` if the generated files are out of date.

Added a `write` option to the generator. When disabled, files are compared but not written.

Added a `metadataChanged` flag to the generator result.
