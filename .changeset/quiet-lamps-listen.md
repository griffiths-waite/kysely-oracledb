---
"kysely-oracledb": major
---

Dialect logging has been reworked to match Kysely's `log` option:

- The `logger` dialect option is replaced by `log`. It accepts an array of levels to log to the console, a function that receives every log event, or a `{ levels, logger }` object to send only some levels to your own function.
- New `formatLogEvent` export, which returns the message the console logger prints, e.g. `kysely-oracledb:query: select * from DUAL (1.2ms)`. Use it to keep the default format with another logger.
- New log levels: `query`, `error`, `connection` and `transaction`. Each one can be turned on separately.
- Log events are typed objects, e.g. `{ level: "query", connectionId, query, queryDurationMillis }`.
- Query events contain the compiled SQL and its parameters separately. Parameter values are no longer inlined into the logged SQL.
- `OracleConnection.formatQueryForLogging` has been removed. Query events contain the SQL and its parameters, so you can format them yourself if needed.

The generator now has its own `logger` option, which only needs `info` and `warn` methods. It logs to the console by default; previously it logged nothing unless you passed a logger.
