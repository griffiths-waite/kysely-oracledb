import { AliasNode, DefaultQueryCompiler } from "kysely";

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

    protected override getCurrentParameterPlaceholder(): string {
        return `:${this.numParameters}`;
    }
}
