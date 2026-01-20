import { Connection, Pool } from "oracledb";
import { vi } from "vitest";

export default {
    createPool: async (): Promise<Pool> => {
        return {
            getConnection: async () => {
                return Promise.resolve({
                    close: vi.fn() as unknown as Connection["close"],
                    commit: vi.fn() as unknown as Connection["commit"],
                    rollback: vi.fn() as unknown as Connection["rollback"],
                    execute: vi.fn(() => {
                        return {
                            rows: [],
                            rowsAffected: 0,
                        };
                    }) as unknown as Connection["execute"],
                } as Connection);
            },
            close: vi.fn() as unknown as Pool["close"],
        } as Pool;
    },
    IntervalYM: class IntervalYM {},
    IntervalDS: class IntervalDS {},
};
