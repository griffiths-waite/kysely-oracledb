---
"kysely-oracledb": minor
---

Added support for `returning` on insert, update and delete queries. Oracle compiles it to `returning ... into` out binds, and the returned values come back as rows. Set the bind type of each returned column with the new `withReturning` helper, e.g. `.returning(["ID"]).$call(withReturning({ ID: oracledb.NUMBER }))`. Its keys are type checked against the returned row.
