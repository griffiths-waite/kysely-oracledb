---
"kysely-oracledb": major
---

added support for quoted identifiers

- query compiler now wraps all identifiers in double quotes
- oracle connection no longer converts column names to lowercase
- internal introspection queries now use uppercase for all identifiers
- sys schema is now defined based on the chosen case option

note: if you are using `CamelCasePlugin` in a schema with nonquoted identifiers, you must set the `upperCase` option to `true` in order for the plugin to correctly map the column names
