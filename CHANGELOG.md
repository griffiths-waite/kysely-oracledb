# kysely-oracledb

## 3.1.0

### Minor Changes

- 449b59a: added support for interval year to month and interval day to second data types when using oracledb version 6.8.0 or higher

### Patch Changes

- 449b59a: return unknown in generator for unsupported data types
- 8ae95bb: Added compiler option for using non quoted identifiers

## 3.0.0

### Major Changes

- 85b902d: added support for quoted identifiers
    - query compiler now wraps all identifiers in double quotes
    - oracle connection no longer converts column names to lowercase
    - internal introspection queries now use uppercase for all identifiers
    - sys schema is now defined based on the chosen case option

    note: if you are using `CamelCasePlugin` in a schema with nonquoted identifiers, you must set the `upperCase` option to `true` in order for the plugin to correctly map the column names

## 2.2.3

### Patch Changes

- 7a3f36a: Updated logger query formatting to format date objects as oracle dates or timestamps

## 2.2.2

### Patch Changes

- 147d936: Added support for Oracle OFFSET and FETCH clauses

## 2.2.1

### Patch Changes

- a731ee7: made prettier an optional dependency to support type generation in production builds

## 2.2.0

### Minor Changes

- 1c946e9: added withExecuteOptions plugin to allow passing executeOptions to specific queries
- 1c946e9: add outBinds to executeQuery method

### Patch Changes

- 1c946e9: removed dependencies on uuid and prettier
- 62b5f71: use the query compiler for parameter placeholder processing
- 30b40a5: fix cjs build issues
- 1c946e9: removed connection map from driver for simplicity

## 2.1.1

### Patch Changes

- 19f8cb9: Relax peer dependency on kysely

## 2.1.0

### Minor Changes

- 53cbaaf: add transaction savepoint implement

## 2.0.8

### Patch Changes

- b0506e1: updated internal introspector data types to use snake case to allow custom introspection

## 2.0.7

### Patch Changes

- af5c3e4: added schema prefix for system tables to allow usage in expression builder queries

## 2.0.6

### Patch Changes

- a84b7a7: pass config option for underscore leading digits to field generation

## 2.0.5

### Patch Changes

- a7c355b: updated generator option for retaining underscores to table fields

## 2.0.4

### Patch Changes

- c8b7896: fixed package json exports

## 2.0.3

### Patch Changes

- 4b4ba1f: added generator option to retain underscores before leading digits when converting to camel case

## 2.0.2

### Patch Changes

- 3f221e5: removed unused import for generate column in generator file if no generated columns exist

## 2.0.1

### Patch Changes

- 9797c4a: removed unused import for column type from generator file

## 2.0.0

### Major Changes

- 33c8128: type mapping updated to correctly return dates and timestamps as JS dates rather than strings
  if you want to keep dates as strings, you will need to convert them to strings yourself

## 1.9.0

### Minor Changes

- 0c2f21f: added new generator options to allow table metadata generation in addition to db types

## 1.8.10

### Patch Changes

- 1129699: added connection id to execution logs and added error logs

## 1.8.9

### Patch Changes

- 57891dd: removing insertid for now as kysely doesn't support Oracle syntax

## 1.8.8

### Patch Changes

- d9eaa86: fixed insertid conversion issue by casting string as bigint to support Oracle syntax

## 1.8.7

### Patch Changes

- 0aac09e: added insertid to execute result

## 1.8.6

### Patch Changes

- 53545f6: use Kysely ColumnType for date fields to allow correct insert type

## 1.8.5

### Patch Changes

- d46258d: added length, precision, and scale attributes to introspector metadata

## 1.8.4

### Patch Changes

- 01fbc4a: fixed issue with system views with \_$ format

## 1.8.3

### Patch Changes

- 2b537ac: added fix for columns with symbols in
- c37ccc1: Added TIMESTAMP(6) type map

## 1.8.2

### Patch Changes

- 114eac1: added more unit tests

## 1.8.1

### Patch Changes

- 4f4639d: fixed issue with view type generation

## 1.8.0

### Minor Changes

- 0790169: added support for transactions and introspecting views

### Patch Changes

- 0790169: fixed incorrect generator message when types haven't changed

## 1.7.4

### Patch Changes

- f508fe3: added number of affected rows to execute result

## 1.7.3

### Patch Changes

- f2c2681: added fix for bind param indexing issue

## 1.7.2

### Patch Changes

- ab377a9: fix readme code example

## 1.7.1

### Patch Changes

- 9e8db98: added fix for database type not using table interface

## 1.7.0

### Minor Changes

- 8f9db16: added support for auto generated columns

## 1.6.6

### Patch Changes

- 8285ea7: added execute opts to dialect config

## 1.6.5

### Patch Changes

- d69a539: fixed issue with camel case util when fields contain numbers

## 1.6.4

### Patch Changes

- 3c6784a: generator formatting tweaks

## 1.6.3

### Patch Changes

- bf5603a: added new generator unit tests and readme updated

## 1.6.2

### Patch Changes

- ce17725: updated readme

## 1.6.1

### Patch Changes

- d655283: updated config options for dialect and generator

## 1.6.0

### Minor Changes

- e5e37ca: added new options for prettier and filepath config

## 1.5.0

### Minor Changes

- 4b5374f: added option to configure camelcase and generate diff check

## 1.4.0

### Minor Changes

- 67801ff: added unit tests for helper functions

## 1.3.0

### Minor Changes

- ff5cc47: added cjs bundle and fixed esm imports

## 1.2.1

### Patch Changes

- f7d254d: fixing bundle size issue

## 1.2.0

### Minor Changes

- f673abf: added type generator

## 1.1.3

### Patch Changes

- 67c3f5b: setting publish access to public

## 1.1.2

### Patch Changes

- 17c9f42: further updates to publishing

## 1.1.1

### Patch Changes

- c33c3a3: update publishing token

## 1.1.0

### Minor Changes

- ed73cf2: initial package creation
