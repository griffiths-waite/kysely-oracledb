import { createHash } from "crypto";
import { ColumnMetadata, TableMetadata } from "kysely";
import { NamingOptions, toFieldName, toTypeName } from "./naming.js";
import { mapColumnType, TypeImport } from "./type-mapping.js";

export interface RenderOptions extends NamingOptions {
    intervalSupport: boolean;
}

interface RenderedTable {
    text: string;
    entry: string;
    imports: TypeImport[];
}

const header = "// This file was generated automatically. Please don't edit it manually!";

const fingerprintPrefix = "// kysely-oracledb:";

const fingerprintPattern = /^\/\/ kysely-oracledb:([0-9a-f]+)$/m;

const indent = "    ";

const baseImports: TypeImport[] = [
    { module: "kysely", name: "Insertable" },
    { module: "kysely", name: "Selectable" },
    { module: "kysely", name: "Updateable" },
];

const toKey = (name: string): string => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : `"${name}"`);

const renderInterface = (name: string, members: string[], exported = false): string =>
    [`${exported ? "export " : ""}interface ${name} {`, ...members.map((member) => `${indent}${member};`), "}"].join(
        "\n",
    );

const renderColumn = (column: ColumnMetadata, options: RenderOptions): { text: string; imports: TypeImport[] } => {
    const { text, imports } = mapColumnType(column, options);

    return { text: `${toKey(toFieldName(column.name, options))}: ${text}`, imports };
};

const renderTable = (table: TableMetadata, options: RenderOptions): RenderedTable => {
    const columns = table.columns.map((column) => renderColumn(column, options));

    const typeName = toTypeName(table.name);

    return {
        text: [
            renderInterface(
                `${typeName}Table`,
                columns.map((column) => column.text),
            ),
            "",
            `export type ${typeName} = Selectable<${typeName}Table>;`,
            `export type New${typeName} = Insertable<${typeName}Table>;`,
            `export type ${typeName}Update = Updateable<${typeName}Table>;`,
        ].join("\n"),
        entry: `${toKey(toFieldName(table.name, options))}: ${typeName}Table`,
        imports: [...baseImports, ...columns.flatMap((column) => column.imports)],
    };
};

const renderImports = (imports: TypeImport[]): string => {
    const modules = new Map<string, Set<string>>();

    for (const { module, name } of imports) {
        const names = modules.get(module) ?? new Set<string>();
        names.add(name);
        modules.set(module, names);
    }

    return [...modules.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([module, names]) => `import type { ${[...names].sort().join(", ")} } from "${module}";`)
        .join("\n");
};

const renderBody = (tables: TableMetadata[], options: RenderOptions): string => {
    const rendered = [...tables]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((table) => renderTable(table, options));

    const sections = [
        renderImports(rendered.flatMap((table) => table.imports)),
        rendered.map((table) => table.text).join("\n\n"),
        renderInterface(
            "DB",
            rendered.map((table) => table.entry),
            true,
        ),
    ];

    return sections.filter(Boolean).join("\n\n");
};

const fingerprint = (body: string): string => createHash("sha256").update(body).digest("hex").slice(0, 16);

export const readFingerprint = (content: string | undefined): string | undefined =>
    content?.match(fingerprintPattern)?.[1];

export const renderTypes = (tables: TableMetadata[], options: RenderOptions): string => {
    const body = renderBody(tables, options);

    return `${header}\n${fingerprintPrefix}${fingerprint(body)}\n\n${body}\n`;
};
