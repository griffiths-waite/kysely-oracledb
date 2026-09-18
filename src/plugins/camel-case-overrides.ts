import { CamelCasePlugin, CamelCasePluginOptions } from "kysely";

/**
 * A `CamelCasePlugin` that accepts overrides for columns whose camelCase name can't be converted
 * back algorithmically. Use the type generator with `camelCaseOptions` to detect which columns
 * require overrides.
 *
 * Each override is keyed by the camelCase property name and points to the database column name.
 *
 * ```ts
 * new CamelCaseOverridesPlugin({ iso2charCode: "ISO_2CHAR_CODE" })
 * ```
 */
export class CamelCaseOverridesPlugin extends CamelCasePlugin {
    #baseCamelCase: (str: string) => string;
    #baseSnakeCase: (str: string) => string;
    #snakeToCamel: Map<string, string>;
    #camelToSnake: Map<string, string>;

    constructor(overrides: Record<string, string>, opt: CamelCasePluginOptions = {}) {
        super(opt);

        this.#baseCamelCase = super.camelCase.bind(this);
        this.#baseSnakeCase = super.snakeCase.bind(this);

        this.#camelToSnake = new Map(Object.entries(overrides));
        this.#snakeToCamel = new Map();

        for (const [propertyName, realName] of this.#camelToSnake) {
            const existing = this.#snakeToCamel.get(realName);

            if (existing) {
                throw new Error(
                    `CamelCaseOverridesPlugin: both "${existing}" and "${propertyName}" override to "${realName}"`,
                );
            }

            this.#snakeToCamel.set(realName, propertyName);
        }
    }

    protected override camelCase(str: string): string {
        return this.#snakeToCamel.get(str) ?? this.#baseCamelCase(str);
    }

    protected override snakeCase(str: string): string {
        return this.#camelToSnake.get(str) ?? this.#baseSnakeCase(str);
    }
}
