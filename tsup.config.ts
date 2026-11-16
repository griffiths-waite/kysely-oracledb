import { defineConfig } from "tsup";

const external = ["oracledb", "kysely"];

export default defineConfig([
    {
        clean: true,
        dts: true,
        sourcemap: true,
        entry: ["./src/index.ts"],
        format: ["esm", "cjs"],
        outDir: "dist",
        external,
    },
    {
        clean: false,
        dts: false,
        sourcemap: true,
        entry: { cli: "./src/cli.ts" },
        format: ["esm"],
        outDir: "dist",
        external,
    },
]);
