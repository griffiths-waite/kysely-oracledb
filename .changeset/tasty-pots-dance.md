---
"kysely-oracledb": patch
---

Generator file paths are now resolved against the current working directory, so relative paths such as `./src/db/types.ts` behave consistently.
