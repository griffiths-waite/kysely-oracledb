export const camelCase = (str: string, underscoreLeadingDigits = false) =>
    str
        .toLowerCase()
        .replace(underscoreLeadingDigits ? /([-_][a-z])/g : /([-_][a-z0-9])/g, (group) =>
            group.toUpperCase().replace("-", "").replace("_", ""),
        );

export const pascalCase = (str: string, underscoreLeadingDigits = false) =>
    camelCase(str, underscoreLeadingDigits).replace(/^[a-z0-9]/, (char) => char.toUpperCase());
