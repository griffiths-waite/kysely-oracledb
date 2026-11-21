import "oracledb";

declare module "oracledb" {
    /**
     * @since 6.8
     */
    export class IntervalYM {
        years?: number | undefined;
        months?: number | undefined;
    }

    /**
     * @since 6.8
     */
    export class IntervalDS {
        days?: number | undefined;
        hours?: number | undefined;
        minutes?: number | undefined;
        seconds?: number | undefined;
        fseconds?: number | undefined;
    }

    /**
     * The `Lob` class, which `@types/oracledb` only declares as an interface.
     */
    export const Lob: {
        new (...args: never[]): Lob;
        prototype: Lob;
    };
}
