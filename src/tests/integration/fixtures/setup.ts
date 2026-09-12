import { createHash } from "crypto";
import { Kysely, sql } from "kysely";
import oracledb from "oracledb";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { OracleDialect } from "../../../dialect/dialect";
import { DB } from "./types-snake-case";

oracledb.fetchAsString = [oracledb.CLOB];

declare module "vitest" {
    export interface TestContext {
        db: Kysely<DB>;
        testId: string;
        getPool: () => oracledb.Pool;
    }
}

let sys: Kysely<DB>;

const createDatabase = async (userId?: string) => {
    if (userId) {
        await dropSchema(userId);
        await createSchema(userId);
    }

    const pool = await oracledb.createPool({
        user: userId ?? "sys",
        password: "oracle",
        connectionString: "localhost:1521/FREEPDB1",
        poolAlias: userId,
        privilege: userId ? undefined : oracledb.SYSDBA,
    });

    return new Kysely<DB>({
        dialect: new OracleDialect({
            pool,
            executeOptions: {
                autoCommit: true,
            },
        }),
    });
};

const readinessCheck = async (db: Kysely<any>) => {
    const maxAttempts = 5;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            await db.selectFrom("DUAL").selectAll().execute();
            break;
        } catch (error) {
            if (i === maxAttempts - 1) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
};

const dropSchema = async (userId: string) => {
    await sql`drop user if exists ${sql.raw(userId)} cascade`.execute(sys);
};

const createSchema = async (userId: string) => {
    await sql`create user ${sql.raw(userId)} identified by oracle`.execute(sys);
    await sql`grant all privileges to ${sql.raw(userId)}`.execute(sys);
};

const dropTables = async (db: Kysely<DB>) => {
    await db.schema.dropView("ACTIVE_ITEMS").ifExists().execute();
    await db.schema.dropTable("ITEM_TAGS").ifExists().execute();
    await db.schema.dropTable("TAGS").ifExists().execute();
    await db.schema.dropTable("ITEMS").ifExists().execute();
};

const createTables = async (db: Kysely<DB>) => {
    await db.schema
        .createTable("ITEMS")
        .addColumn("ID", sql`number generated always as identity`, (col) => col.primaryKey())
        .addColumn("NAME", sql`varchar2(255)`, (col) => col.notNull())
        .addColumn("CODE", sql`char(1)`, (col) => col.notNull().defaultTo("A"))
        .addColumn("AMOUNT", sql`number(10,2)`)
        .addColumn("NOTES", sql`clob`)
        .addColumn("CREATED_AT", sql`date`, (col) => col.notNull().defaultTo(sql`sysdate`))
        .addColumn("UPDATED_AT", sql`date`)
        .execute();

    await db.schema
        .createTable("TAGS")
        .addColumn("ID", sql`number generated always as identity`, (col) => col.primaryKey())
        .addColumn("NAME", sql`varchar2(255)`, (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("ITEM_TAGS")
        .addColumn("ITEM_ID", sql`number`, (col) => col.notNull().references("ITEMS.ID"))
        .addColumn("TAG_ID", sql`number`, (col) => col.notNull().references("TAGS.ID"))
        .addPrimaryKeyConstraint("ITEM_TAGS_PK", ["ITEM_ID", "TAG_ID"])
        .execute();

    await db.schema
        .createView("ACTIVE_ITEMS")
        .as(db.selectFrom("ITEMS").select(["ID", "NAME"]).where("CODE", "=", "A"))
        .execute();
};

beforeAll(async () => {
    const db = await createDatabase();
    sys = db;

    await readinessCheck(db);
});

afterAll(async () => {
    try {
        await sys.destroy();
    } catch (err) {}
});

beforeEach(async (context) => {
    const userId =
        "TEST_" +
        createHash("md5")
            .update(context.task.file.filepath + context.task.name)
            .digest("hex")
            .toUpperCase();

    context.getPool = () => oracledb.getPool(userId);
    context.db = await createDatabase(userId);
    context.testId = userId;

    await dropTables(context.db);
    await createTables(context.db);
});

afterEach(async (context) => {
    try {
        await context.db.destroy();
    } catch (err) {}
});
