import {
    AliasNode,
    CompiledQuery,
    DefaultQueryCompiler,
    FetchNode,
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
        this.visitNode(node.node);
        this.append(" ");
        this.#useNonQuotedIdentifiers && this.append('"');
        this.visitNode(node.alias);
        this.#useNonQuotedIdentifiers && this.append('"');
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
