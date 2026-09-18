---
"kysely-oracledb": major
---

Removed the `underscoreLeadingDigits` generator option. It changed the generated property name, but Kysely's `CamelCasePlugin` never produces that value when mapping a result row back to camelCase under any option, so the generated type didn't match the real runtime value. Generated property names now always use the standard camelCase form.

Added `camelCaseOptions` to the generator which now outputs a warning if any columns are detected that can't be safely converted from camelCase back to the real column name.

Added `CamelCaseOverridesPlugin` which accepts overrides for flagged columns, converting them to the provided value instead of using the standard `CamelCasePlugin` algorithm.
