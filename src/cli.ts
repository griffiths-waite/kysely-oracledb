#!/usr/bin/env node
import { createRequire } from "module";
import { runCli } from "./cli/run.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

process.exitCode = await runCli(process.argv.slice(2), process.env, { version });
