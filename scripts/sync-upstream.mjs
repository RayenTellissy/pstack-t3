#!/usr/bin/env node
// Replace vendor/pstack with pstack/ from cursor/plugins at a ref (default: main), then record the commit.
// Usage: node scripts/sync-upstream.mjs [ref]

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/cursor/plugins.git";
const ref = process.argv[2] ?? "main";
const tmp = mkdtempSync(join(tmpdir(), "pstack-upstream-"));
const git = (...args) => execFileSync("git", ["-C", tmp, ...args], { encoding: "utf8" }).trim();

try {
  execFileSync("git", ["clone", "--quiet", "--filter=blob:none", "--no-checkout", REPO, tmp], { stdio: "inherit" });
  git("sparse-checkout", "set", "pstack");
  git("checkout", "--quiet", ref);
  const sha = git("rev-parse", "HEAD");
  const out = join(ROOT, "vendor", "pstack");
  rmSync(out, { recursive: true, force: true });
  cpSync(join(tmp, "pstack"), out, { recursive: true });
  writeFileSync(join(ROOT, "UPSTREAM"), `${REPO.replace(/\.git$/, "")}/tree/${sha}/pstack\n`);
  console.log(`vendor/pstack synced to ${sha}. Run \`node scripts/build.mjs\` next.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
