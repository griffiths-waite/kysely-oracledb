import { defineConfig } from "tsup";

export default defineConfig({
    clean: true,
    dts: true,
    sourcemap: true,
    entry: ["./src/index.ts"],
    format: ["esm", "cjs"],
    outDir: "dist",
    external: ["oracledb", "kysely", "prettier"],
});
