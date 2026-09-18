import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        reporters: ["default"],
        env: {
            TZ: "UTC",
        },
        coverage: {
            provider: "istanbul",
            reporter: ["lcov", "html", "text"],
            reportsDirectory: "coverage",
            include: ["src/**/*.ts"],
            exclude: ["**/tests/**", "**/*.d.ts"],
        },
        projects: [
            {
                extends: true,
                test: {
                    name: "unit",
                    include: ["src/tests/unit/**/*.test.ts"],
                },
            },
            {
                extends: true,
                test: {
                    name: "integration",
                    include: ["src/tests/integration/**/*.test.ts"],
                    setupFiles: ["src/tests/integration/fixtures/setup.ts"],
                },
            },
        ],
    },
});
