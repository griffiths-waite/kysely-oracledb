import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        root: "src",
        reporters: ["default"],
        coverage: {
            provider: "istanbul",
            reporter: ["lcov", "html", "text"],
            reportsDirectory: "../coverage",
            exclude: ["**/tests/**"],
        },
        workspace: [
            {
                extends: true,
                test: {
                    name: "unit",
                    include: ["tests/unit/**/*.test.ts"],
                },
            },
            {
                extends: true,
                test: {
                    name: "integration",
                    include: ["tests/integration/**/*.test.ts"],
                    setupFiles: ["tests/integration/fixtures/setup.ts"],
                },
            },
        ],
    },
});
