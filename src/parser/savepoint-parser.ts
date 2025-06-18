import { IdentifierNode, RawNode } from "kysely";

export function parseSavepointCommand(command: string, savepointName: string): RawNode {
    return RawNode.createWithChildren([
        RawNode.createWithSql(`${command} `),
        IdentifierNode.create(savepointName), // ensures savepointName gets sanitized
    ]);
}
