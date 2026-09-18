import { toCamelCase } from "./camel-case.js";

export interface NamingOptions {
    camelCase: boolean;
}

export const toTypeName = (name: string): string => name[0].toUpperCase() + toCamelCase(name).slice(1);

export const toFieldName = (name: string, options: NamingOptions): string =>
    options.camelCase ? toCamelCase(name) : name;
