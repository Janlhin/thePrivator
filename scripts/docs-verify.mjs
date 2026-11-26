#!/usr/bin/env node
// Docs gate (T-012): the three documentation checks from AGENTS.md §10.
//
//   1. lint        markdownlint style/structure rules (.markdownlint.json)
//   2. links       offline check of repo-relative links and anchors; external
//                  http(s)/mailto targets are skipped on purpose (no network)
//   3. codeblocks  extract fenced code blocks; blocks marked `runnable` in the
//                  fence info string are executed against a command whitelist.
//                  Every other block is only extracted, never run.
//
// Orchestration lives in scripts/verify.ps1; this file holds the check logic.
// Markdown is intentionally not part of the oxfmt pass (D-011).

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { lint } from "markdownlint/promise";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(root, ".markdownlint.json");

// CHANGELOG.md is aggregated release history with a dense conventional
// layout; it is excluded from the docs gate (see commit message for rationale).
const IGNORE_FILES = ["CHANGELOG.md"];

const layer = process.argv[2] || "all";

function trackedMarkdown() {
  const out = execSync('git ls-files "*.md"', { cwd: root, encoding: "utf8" });
  return out
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => !IGNORE_FILES.includes(file));
}

// ---------------------------------------------------------------------------
// Layer 1: markdownlint
// ---------------------------------------------------------------------------

async function checkLint(files) {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const result = await lint({ files: files.map((file) => join(root, file)), config });
  const problems = [];
  for (const [absPath, errors] of Object.entries(result)) {
    for (const error of errors) {
      const rel = relative(root, absPath).replace(/\\/g, "/");
      problems.push(`${rel}:${error.lineNumber} ${error.ruleNames[1]} ${error.errorDetail || ""}`.trim());
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Layer 2: offline relative links and anchors
// ---------------------------------------------------------------------------

function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/[`~*_]/g, "")
    .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function headingsOf(text) {
  const slugs = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (match) slugs.add(slugify(match[1]));
  }
  return slugs;
}

function extractLinkTargets(text) {
  const targets = [];
  const refDefinitions = new Map();
  const refDef = /^\s*\[([^\]]+)\]:\s*(\S+)/gm;
  let def;
  while ((def = refDef.exec(text))) refDefinitions.set(def[1].toLowerCase(), def[2]);

  const inline = /(!?)\[([^\]]*)\]\s*(?:\[([^\]]*)\]|\(([^)\s]+)(?:\s+"[^"]*")?\))/g;
  let match;
  while ((match = inline.exec(text))) {
    const ref = match[3];
    if (ref !== undefined) {
      const target = refDefinitions.get(ref.toLowerCase());
      if (target) targets.push(target);
    } else if (match[4]) {
      targets.push(match[4]);
    }
  }
  return targets;
}

function checkLinks(files) {
  const problems = [];
  const textByFile = new Map(files.map((file) => [file, readFileSync(join(root, file), "utf8")]));

  for (const file of files) {
    const text = textByFile.get(file);
    const fileDir = dirname(join(root, file));

    for (const target of extractLinkTargets(text)) {
      if (/^(https?:|mailto:|tel:)/i.test(target)) continue; // external, offline gate does not fetch
      if (target.startsWith("<")) continue; // angle autolink

      const [pathPart, anchor] = target.split("#");

      if (pathPart === "") {
        if (anchor && !headingsOf(text).has(slugify(anchor))) {
          problems.push(`${file}: anchor #${anchor} not found in ${file}`);
        }
        continue;
      }

      const resolved = resolve(fileDir, pathPart);
      const relToRoot = relative(root, resolved);
      if (relToRoot.startsWith("..") || relToRoot === "") {
        // Link escapes the repository (e.g. ../../releases on the GitHub UI).
        // Not a repo file, so the offline gate leaves it alone.
        continue;
      }
      if (!existsSync(resolved)) {
        problems.push(`${file}: broken relative link ${target}`);
        continue;
      }
      if (anchor && !statSync(resolved).isDirectory()) {
        const targetText = readFileSync(resolved, "utf8");
        if (!headingsOf(targetText).has(slugify(anchor))) {
          problems.push(`${file}: anchor #${anchor} not found in ${relative(root, resolved)}`);
        }
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Layer 3: fenced code block extraction and safe execution
// ---------------------------------------------------------------------------

// Commands that must never run inside the docs gate: they install/download
// network state, mutate the working tree, build artifacts, or touch accounts.
const BLOCKED_PATTERN =
  /\b(install|ci|build|publish|push|pull|login|logout|curl|wget|apt|pip|npm\s+i|venv|download|clone|sudo|xvfb-run|sidecar:|tauri\s+(dev|build)|pack)\b/i;

// Whitelist of command shapes the gate may execute. Read-only local commands
// only; anything else must stay an extracted, non-runnable block.
const RUNNABLE_PATTERNS = [
  /^node --version\b/,
  /^node --test\s+\S+/,
  /^python --version\b/,
  /^pwsh --version\b/,
  /^cargo --version\b/,
];

function extractBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let open = null;
  lines.forEach((line, index) => {
    const match = line.match(/^```(.*)$/);
    if (match) {
      if (!open) {
        open = { info: match[1], start: index + 1, body: [] };
      } else {
        blocks.push({ ...open, end: index + 1 });
        open = null;
      }
      return;
    }
    if (open) open.body.push(line);
  });
  if (open) blocks.push({ ...open, end: lines.length, unclosed: true });
  return blocks;
}

function parseCommand(line) {
  // Whitelist commands are simple `binary arg...` forms without shell quoting
  // tricks. Split on whitespace after stripping an inline trailing comment.
  const withoutComment = line.replace(/\s+#.*$/, "").trim();
  return withoutComment.split(/\s+/).filter(Boolean);
}

function checkCodeBlocks(files) {
  const problems = [];
  let extracted = 0;
  let runnable = 0;
  let executed = 0;

  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const block of extractBlocks(text)) {
      extracted += 1;
      if (block.unclosed) {
        problems.push(`${file}:${block.start} unclosed fenced code block`);
        continue;
      }
      const tokens = block.info.split(/\s+/).filter(Boolean);
      const lang = tokens[0] || "";
      const markers = new Set(tokens.slice(1));
      const isRunnable = markers.has("runnable");

      if (!isRunnable) continue;
      runnable += 1;

      const commands = block.body.map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
      for (const command of commands) {
        const argv = parseCommand(command);
        const allowed = RUNNABLE_PATTERNS.some((pattern) => pattern.test(command));
        if (!allowed) {
          if (BLOCKED_PATTERN.test(command)) {
            problems.push(`${file}:${block.start} runnable block contains a blocked command: ${command}`);
          } else {
            problems.push(`${file}:${block.start} runnable command is not on the whitelist: ${command}`);
          }
          continue;
        }

        const result = spawnSync(argv[0], argv.slice(1), {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        });
        if (result.error) {
          problems.push(`${file}:${block.start} failed to spawn ${argv[0]}: ${result.error.message}`);
          continue;
        }
        if (result.status !== 0) {
          const stderr = (result.stderr || "").trim().split(/\r?\n/).slice(-5).join(" | ");
          problems.push(
            `${file}:${block.start} command exited ${result.status}: ${command}${stderr ? ` — ${stderr}` : ""}`,
          );
          continue;
        }
        executed += 1;
      }
    }
  }

  console.log(`code blocks: extracted=${extracted} runnable=${runnable} executed=${executed}`);
  return problems;
}

// ---------------------------------------------------------------------------

async function main() {
  const files = trackedMarkdown();
  const failures = [];

  if (layer === "lint" || layer === "all") {
    failures.push(...(await checkLint(files)));
  }
  if (layer === "links" || layer === "all") {
    failures.push(...checkLinks(files));
  }
  if (layer === "codeblocks" || layer === "all") {
    failures.push(...checkCodeBlocks(files));
  }

  if (failures.length > 0) {
    console.error(`docs verify failed (${failures.length} problem${failures.length === 1 ? "" : "s"}):`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }

  console.log(`docs verify passed: ${files.length} markdown files, layer=${layer}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
