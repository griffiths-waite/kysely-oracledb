import { describe, expect, it } from "vitest";
import { camelCase, pascalCase } from "./utils.js";

describe("camelCase", () => {
    it("should convert snake_case to camelCase", () => {
        expect(camelCase("snake_case")).toBe("snakeCase");
    });
    it("should convert kebab-case to camelCase", () => {
        expect(camelCase("kebab-case")).toBe("kebabCase");
    });
    it("should convert snake_case with number to camelCase", () => {
        expect(camelCase("snake_1case")).toBe("snake1case");
    });
    it("should convert kebab-case with number to camelCase", () => {
        expect(camelCase("kebab-1case")).toBe("kebab1case");
    });
    it("should convert snake_case with number to camelCase using leading number option", () => {
        expect(camelCase("snake_1case_end2", true)).toBe("snake_1caseEnd2");
    });
});

describe("pascalCase", () => {
    it("should convert snake_case to PascalCase", () => {
        expect(pascalCase("snake_case")).toBe("SnakeCase");
    });
    it("should convert kebab-case to PascalCase", () => {
        expect(pascalCase("kebab-case")).toBe("KebabCase");
    });
    it("should convert snake_case with number to PascalCase", () => {
        expect(pascalCase("snake_1case")).toBe("Snake1case");
    });
    it("should convert kebab-case with number to PascalCase", () => {
        expect(pascalCase("kebab-1case")).toBe("Kebab1case");
    });
    it("should convert snake_case with number to PascalCase using leading number option", () => {
        expect(pascalCase("snake_1case_end2", true)).toBe("Snake_1caseEnd2");
    });
});
