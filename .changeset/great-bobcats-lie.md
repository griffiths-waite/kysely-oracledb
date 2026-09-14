---
"kysely-oracledb": major
---

Reworked database introspector:

- Removed `getViews` method to align with the default introspector. Tables and views are now both fetched using the `getTables` method.
- Removed introspector options from the generator config and moved them to a dedicated `introspectorOptions` property on the dialect config.
- Removed generator config from the dialect. The generator now accepts its own dedicated config.
