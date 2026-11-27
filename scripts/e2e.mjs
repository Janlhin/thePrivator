// Entry for the Playwright E2E smoke (`npm run test:e2e`).
//
// Playwright 1.60 loads its TypeScript config and specs through the Node ESM
// loader registered via `node:module.register`. Some Node nightlies have
// dropped that API in favour of `registerHooks`, so we pick a Node binary that
// still exposes `register` before spawning the Playwright CLI.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(root, "node_modules", "@playwright", "test", "cli.js");

function currentNodeSupportsLoader() {
  try {
    const module = require("node:module");
    return typeof module.register === "function";
  } catch {
    return false;
  }
}

function fallbackNodeCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return [];
  const exe = process.platform === "win32" ? "node.exe" : "node";
  return [path.join(localAppData, "vite-plus", "data", "fallback-bin", exe)];
}

function pickNode() {
  if (currentNodeSupportsLoader()) return process.execPath;
  for (const candidate of fallbackNodeCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return process.execPath;
}

const nodeBinary = pickNode();
const result = spawnSync(nodeBinary, [cliEntry, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
