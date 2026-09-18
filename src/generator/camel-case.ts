import { CamelCasePluginOptions } from "kysely";

const isDigit = (char: string): boolean => char >= "0" && char <= "9";

const isAllUpperCaseSnakeCase = (value: string): boolean => {
    for (let i = 1, l = value.length; i < l; i++) {
        const char = value[i];

        if (char !== "_" && char !== char.toUpperCase()) {
            return false;
        }
    }

    return true;
};

/**
 * Matches the Kysely snake_case -> camelCase transformation algorithm
 */
export const toCamelCase = (value: string): string => {
    if (value.length === 0) {
        return value;
    }

    const source = isAllUpperCaseSnakeCase(value) ? value.toLowerCase() : value;

    let out = source[0];

    for (let i = 1, l = source.length; i < l; i++) {
        const char = source[i];
        const prevChar = source[i - 1];

        if (char !== "_") {
            out += prevChar === "_" ? char.toUpperCase() : char;
        }
    }

    return out;
};

/**
 * Matches the Kysely camelCase -> snake_case transformation algorithm
 */
const toSnakeCase = (value: string, options: CamelCasePluginOptions): string => {
    if (value.length === 0) {
        return value;
    }

    const upper = value.toUpperCase();
    const lower = value.toLowerCase();

    let out = lower[0];

    for (let i = 1, l = value.length; i < l; i++) {
        const char = value[i];
        const prevChar = value[i - 1];

        const upperChar = upper[i];
        const prevUpperChar = upper[i - 1];

        const lowerChar = lower[i];
        const prevLowerChar = lower[i - 1];

        if (options.underscoreBeforeDigits && isDigit(char) && !isDigit(prevChar) && !out.endsWith("_")) {
            out += `_${char}`;
            continue;
        }

        if (char === upperChar && upperChar !== lowerChar) {
            const prevCharacterIsUppercase = prevChar === prevUpperChar && prevUpperChar !== prevLowerChar;

            out += options.underscoreBetweenUppercaseLetters || !prevCharacterIsUppercase ? `_${lowerChar}` : lowerChar;
        } else {
            out += char;
        }
    }

    return out;
};

export const isConversionSafe = (realName: string, propertyName: string, options: CamelCasePluginOptions): boolean =>
    toSnakeCase(propertyName, options).toUpperCase() === realName.toUpperCase();
