---
"kysely-oracledb": minor
---

Replaced unit tests with integration tests that use a local docker database.

Updated the query compiler to handle column modification (add, alter, modify, and drop).

Disable auto-commit when transactions are active to prevent individual statements being committed early.
