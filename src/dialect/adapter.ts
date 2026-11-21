import { DialectAdapterBase, Kysely } from "kysely";

export class OracleAdapter extends DialectAdapterBase {
    #supportsReturning = true;
    #supportsTransactionalDdl = false;

    override get supportsReturning(): boolean {
        return this.#supportsReturning;
    }

    override get supportsTransactionalDdl(): boolean {
        return this.#supportsTransactionalDdl;
    }

    async acquireMigrationLock(_: Kysely<any>): Promise<void> {
        throw new Error("Not implemented");
    }

    async releaseMigrationLock(_: Kysely<any>): Promise<void> {
        throw new Error("Not implemented");
    }
}
