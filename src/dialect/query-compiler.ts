import { AliasNode, CompiledQuery, DefaultQueryCompiler, QueryId, RootOperationNode } from "kysely";
import { ExecuteOptions } from "oracledb";

export type OracleNode = RootOperationNode & {
    executeOptions?: ExecuteOptions;
};

export interface OracleCompiledQuery extends CompiledQuery {
    executeOptions?: ExecuteOptions;
}

export class OracleQueryCompiler extends DefaultQueryCompiler {
    protected override getLeftIdentifierWrapper(): string {
        return "";
    }

    protected override getRightIdentifierWrapper(): string {
        return "";
    }

    protected override visitAlias(node: AliasNode): void {
        this.visitNode(node.node);
        this.append(" ");
        this.visitNode(node.alias);
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
