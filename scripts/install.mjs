#!/usr/bin/env node
// Link every pstack skill into the skill folders T3 Code's providers read.
//
// Usage: node scripts/install.mjs [--project <dir>] [--targets agents,claude,gemini] [--force] [--uninstall] [--dry-run]
//
//   default      user scope: ~/.agents/skills, ~/.claude/skills, and ~/.gemini/config/skills when ~/.gemini exists
//   --project    project scope: <dir>/.agents/skills and <dir>/.claude/skills
//   --force      move a conflicting skill that is not ours aside to <name>.pre-pstack-t3 (or -2, -3, ... when taken) instead of skipping it
//   --uninstall  remove only the links that point into this checkout, and move <name>.pre-pstack-t3 back when the name is free

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`${name} needs a value`);
  return args[i + 1];
};

const project = option("--project");
const base = project ? resolve(project) : homedir();
const all = {
  agents: join(base, ".agents", "skills"),
  claude: join(base, ".claude", "skills"),
  ...(project ? {} : { gemini: join(base, ".gemini", "config", "skills") }),
};
const requested = option("--targets")?.split(",") ?? Object.keys(all);
for (const name of requested) if (!all[name]) throw new Error(`unknown target ${name}; choose from ${Object.keys(all).join(", ")}`);
const targets = requested.filter((name) => name !== "gemini" || option("--targets") || existsSync(join(base, ".gemini")));

const dryRun = flag("--dry-run");
const act = (description, effect) => {
  console.log(`${dryRun ? "would " : ""}${description}`);
  if (!dryRun) effect();
};
const linkTarget = (path) => {
  try {
    return lstatSync(path).isSymbolicLink() ? resolve(dirname(path), readlinkSync(path)) : undefined;
  } catch {
    return undefined;
  }
};
const ours = (path) => linkTarget(path)?.startsWith(SKILLS + "/") ?? false;
const present = (path) => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};
const BACKUP = ".pre-pstack-t3";
// rename() silently replaces a file or symlink at the destination, so never reuse a backup name.
const freeBackup = (path) => {
  for (let n = 1; ; n++) {
    const candidate = `${path}${BACKUP}${n === 1 ? "" : `-${n}`}`;
    if (!present(candidate)) return candidate;
  }
};

const skills = readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md")));
const skipped = [];

for (const target of targets) {
  const dir = all[target];
  if (flag("--uninstall")) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (!ours(path)) continue;
      act(`remove ${path}`, () => rmSync(path));
      if (present(`${path}${BACKUP}`)) act(`restore ${path}${BACKUP} to ${path}`, () => renameSync(`${path}${BACKUP}`, path));
    }
    continue;
  }
  if (!dryRun) mkdirSync(dir, { recursive: true });
  for (const name of skills) {
    const path = join(dir, name);
    const source = join(SKILLS, name);
    if (linkTarget(path) === source) continue;
    const exists = present(path);
    if (exists && !ours(path)) {
      if (!flag("--force")) {
        skipped.push(path);
        continue;
      }
      const backup = freeBackup(path);
      act(`move ${path} aside to ${backup}`, () => renameSync(path, backup));
    } else if (exists) {
      act(`replace stale link ${path}`, () => rmSync(path));
    }
    act(`link ${path}`, () => symlinkSync(source, path, "dir"));
  }
}

if (skipped.length > 0) {
  console.log(`\nSkipped ${skipped.length} skill(s) that already exist and are not from this checkout:`);
  for (const path of skipped) console.log(`  ${path}`);
  console.log("Rerun with --force to move them aside, or remove them yourself.");
}
if (!flag("--uninstall")) {
  console.log(`\nDone. In T3 Code, run "Restart agent session" from the command palette, then $setup-pstack.`);
}
