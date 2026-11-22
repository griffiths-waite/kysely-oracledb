---
"kysely-oracledb": patch
---

`.fetch(n, "with ties")` now compiles to `fetch first :1 rows with ties` instead of dropping the modifier and emitting `rows only`, so rows that tie at the cutoff are no longer left out.
