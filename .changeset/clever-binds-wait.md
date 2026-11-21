---
"kysely-oracledb": major
---

`OracleQueryResult` now has a separate type parameter for `outBinds`: `OracleQueryResult<R, O>` types the rows as `R` and `outBinds` as `O`, which defaults to `unknown`. Previously `outBinds` was typed as the row type.
