import {
    AddColumnNode,
    AliasNode,
    AlterColumnNode,
    CompiledQuery,
    DefaultQueryCompiler,
    DropColumnNode,
    DropConstraintNode,
    FetchNode,
    IdentifierNode,
    InsertQueryNode,
    MergeQueryNode,
    ModifyColumnNode,
    OffsetNode,
    OperationNode,
    QueryId,
    ReferenceNode,
    ReturningNode,
    RootOperationNode,
    SelectAllNode,
    SelectionNode,
    ValuesNode,
} from "kysely";
import oracledb, { ExecuteOptions } from "oracledb";
import { ReturningBinds } from "../plugins/with-returning.js";

export interface CompilerOptions {
    /**
     * Whether to use non-quoted identifiers for object names.
     *
     * @default false
     */
    useNonQuotedIdentifiers?: boolean;
}

export type OracleNode = RootOperationNode & {
    executeOptions?: ExecuteOptions;
    returningBinds?: ReturningBinds;
};

export interface OracleCompiledQuery extends CompiledQuery {
    executeOptions?: ExecuteOptions;
    returningColumns?: string[];
}

interface ReturningColumn {
    name: string;
    expression: OperationNode;
}

export class OracleQueryCompiler extends DefaultQueryCompiler {
    #useNonQuotedIdentifiers: boolean;
    #returningBinds?: ReturningBinds;
    #returningColumns?: string[];

    constructor(compilerOptions?: CompilerOptions) {
        super();
        this.#useNonQuotedIdentifiers = compilerOptions?.useNonQuotedIdentifiers ?? false;
    }

    protected override getLeftIdentifierWrapper(): string {
        return this.#useNonQuotedIdentifiers ? "" : '"';
    }

    protected override getRightIdentifierWrapper(): string {
        return this.#useNonQuotedIdentifiers ? "" : '"';
    }

    protected override visitAlias(node: AliasNode): void {
        const isTableAlias = node.node.kind === "TableNode" || node.node.kind === "SelectQueryNode";
        this.visitNode(node.node);
        this.append(" ");
        if (this.#useNonQuotedIdentifiers && !isTableAlias) {
            this.append('"');
        }
        this.visitNode(node.alias);
        if (this.#useNonQuotedIdentifiers && !isTableAlias) {
            this.append('"');
        }
    }

    protected override getCurrentParameterPlaceholder(): string {
        return `:${this.numParameters}`;
    }

    protected override visitOffset(node: OffsetNode): void {
        this.append("offset ");
        this.visitNode(node.offset);
        this.append(" rows");
    }

    protected override visitFetch(node: FetchNode): void {
        this.append("fetch first ");
        this.visitNode(node.rowCount);
        this.append(" rows only");
    }

    protected override visitAddColumn(node: AddColumnNode): void {
        this.append("add ");
        this.visitNode(node.column);
    }

    protected override visitModifyColumn(node: ModifyColumnNode): void {
        this.append("modify ");
        this.visitNode(node.column);
    }

    protected override visitAlterColumn(node: AlterColumnNode): void {
        this.append("modify ");
        this.visitNode(node.column);
        this.append(" ");

        if (node.dataType) {
            this.visitNode(node.dataType);
        }

        if (node.setDefault) {
            this.append("default ");
            this.visitNode(node.setDefault);
        }

        if (node.dropDefault) {
            this.append("default null");
        }

        if (node.setNotNull) {
            this.append("not null");
        }

        if (node.dropNotNull) {
            this.append("null");
        }
    }

    protected override visitDropColumn(node: DropColumnNode): void {
        if (node.ifExists) {
            throw new Error("Drop column with `if exists` is not supported by Oracle.");
        }

        super.visitDropColumn(node);
    }

    protected override visitDropConstraint(node: DropConstraintNode): void {
        if (node.ifExists) {
            throw new Error("Drop constraint with `if exists` is not supported by Oracle.");
        }

        super.visitDropConstraint(node);
    }

    protected override visitReturning(node: ReturningNode): void {
        const columns = node.selections.map((selection) => this.#getReturningColumn(selection));

        this.append("returning ");
        columns.forEach(({ expression }, index) => {
            if (index > 0) {
                this.append(", ");
            }
            this.visitNode(expression);
        });

        this.append(" into ");
        columns.forEach(({ name }, index) => {
            if (index > 0) {
                this.append(", ");
            }
            this.appendValue({ dir: oracledb.BIND_OUT, ...this.#getReturningBind(name) });
        });

        this.#returningColumns = columns.map(({ name }) => name);
    }

    protected override visitInsertQuery(node: InsertQueryNode): void {
        if (node.returning && !(node.values && ValuesNode.is(node.values) && node.values.values.length === 1)) {
            throw new Error("Insert with `returning` only supports a single row of values in Oracle.");
        }

        super.visitInsertQuery(node);
    }

    protected override visitMergeQuery(node: MergeQueryNode): void {
        if (node.returning) {
            throw new Error("Merge with `returning` is not supported by Oracle.");
        }

        super.visitMergeQuery(node);
    }

    #getReturningColumn(node: SelectionNode): ReturningColumn {
        const selection = node.selection;

        if (AliasNode.is(selection) && IdentifierNode.is(selection.alias)) {
            return { name: selection.alias.name, expression: selection.node };
        }

        if (
            SelectAllNode.is(selection) ||
            (ReferenceNode.is(selection) &&
                (SelectAllNode.is(selection.column) || selection.column.column.name === "*"))
        ) {
            throw new Error("Returning all columns is not supported by Oracle. List the columns to return.");
        }

        if (ReferenceNode.is(selection) && !SelectAllNode.is(selection.column)) {
            const name = selection.column.column.name;
            return {
                name: this.#useNonQuotedIdentifiers ? name.toUpperCase() : name,
                expression: selection,
            };
        }

        throw new Error('Returning an expression requires an alias, e.g. `sql<number>`...`.as("name")`.');
    }

    #getReturningBind(name: string) {
        const bind = this.#returningBinds?.[name] ?? this.#findLooseReturningBind(name);

        if (bind === undefined) {
            throw new Error(
                `Missing bind type for returning column "${name}". Set it with \`withReturning\`, e.g. \`.$call(withReturning({ ${name}: oracledb.NUMBER }))\`.`,
            );
        }

        return typeof bind === "object" && "type" in bind ? bind : { type: bind };
    }

    /**
     * Matches a key ignoring case and underscores, so camelCase keys such as `createdAt` find the
     * `CREATED_AT` column after `CamelCasePlugin` has renamed it.
     */
    #findLooseReturningBind(name: string) {
        const normalize = (value: string) => value.replace(/_/g, "").toLowerCase();
        const matches = Object.entries(this.#returningBinds ?? {}).filter(
            ([key]) => normalize(key) === normalize(name),
        );

        if (matches.length > 1) {
            throw new Error(
                `Ambiguous bind type for returning column "${name}". It matches ${matches.map(([key]) => `"${key}"`).join(", ")}.`,
            );
        }

        return matches[0]?.[1];
    }

    compileQuery(node: RootOperationNode, queryId: QueryId): OracleCompiledQuery {
        const { executeOptions, returningBinds } = node as OracleNode;

        this.#returningBinds = returningBinds;
        this.#returningColumns = undefined;

        let compiledQuery: OracleCompiledQuery;
        try {
            compiledQuery = super.compileQuery(node, queryId);
        } finally {
            this.#returningBinds = undefined;
        }

        const returningColumns = this.#returningColumns;
        this.#returningColumns = undefined;

        if (executeOptions) {
            compiledQuery = { ...compiledQuery, executeOptions };
        }
        if (returningColumns) {
            compiledQuery = { ...compiledQuery, returningColumns };
        }
        return compiledQuery;
    }
}
