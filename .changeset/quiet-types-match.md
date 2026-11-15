---
"kysely-oracledb": major
---

Reworked the generator type mapping to match what node-oracledb returns and what `ALL_TAB_COLUMNS` reports:

- `BLOB`, `RAW` and `LONG RAW` now map to `Buffer` instead of `string`. `BLOB` is only a `Buffer` when `oracledb.fetchAsBuffer` includes `oracledb.BLOB`.
- `VECTOR` now maps to `Float32Array | Float64Array | Int8Array | Uint8Array` instead of `string`.
- `JSON` and `BFILE` now map to `unknown` instead of `string`. The driver returns parsed JSON and `Lob` instances for these.
- Added `BOOLEAN` (mapped to `boolean`) and `UROWID` (mapped to `string`), which previously mapped to `unknown`.
- Removed the `PL/SQL BOOLEAN`, `BINARY_INTEGER`, `SYS_REFCURSOR` and `OBJECT` mappings. They are PL/SQL or driver type names that never appear as table column types.
- Type names are matched using the driver's `DB_TYPE_*` column type names with length, precision and scale removed, so `TIMESTAMP(6) WITH TIME ZONE` and `INTERVAL DAY(2) TO SECOND(6)` resolve consistently.
