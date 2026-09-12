import {
    AddColumnNode,
    AliasNode,
    AlterColumnNode,
    CompiledQuery,
    DefaultQueryCompiler,
    DropColumnNode,
    DropConstraintNode,
    FetchNode,
    ModifyColumnNode,
    OffsetNode,
    QueryId,
    RootOperationNode,
} from "kysely";
import { ExecuteOptions } from "oracledb";

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
};

export interface OracleCompiledQuery extends CompiledQuery {
    executeOptions?: ExecuteOptions;
}

export class OracleQueryCompiler extends DefaultQueryCompiler {
    #useNonQuotedIdentifiers: boolean;

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

    compileQuery(node: RootOperationNode, queryId: QueryId): OracleCompiledQuery {
        const compiledQuery = super.compileQuery(node, queryId) as OracleCompiledQuery;
        if ((node as OracleNode).executeOptions) {
            return {
                ...compiledQuery,
                executeOptions: (node as OracleNode).executeOptions,
            };
        }
        return compiledQuery;
    }
}
