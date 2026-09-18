---
"kysely-oracledb": major
---

Generator change detection updated:

- The `checkDiff` option is removed and always enabled - types are only updated if they have changed.
- A fingerprint is embedded into the file header and compared to detect changes. This allows the prettier dependency to be completely removed since files can still be compared even after formatting.
- The generator now returns a `changed` flag to indicate if the types have changed.
- Metadata is compared separately to types so the generated metadata file is still updated even if it does not trigger a change to the types file.
