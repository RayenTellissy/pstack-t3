#!/usr/bin/env node
// Tests for the translated skills and the install script. Run: node --test scripts/test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync,
  symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const SKILL_NAMES = readdirSync(SKILLS).filter((n) => existsSync(join(SKILLS, n, "SKILL.md")));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if ([".git", "node_modules", "scripts"].includes(e.name)) return [];
    const path = join(dir, e.name);
    return e.isDirectory() ? walk(path) : [path];
  });
const MARKDOWN = walk(ROOT).filter((p) => p.endsWith(".md"));

// Cursor-only names that must not survive translation. The plain word "Cursor" stays legal: it is
// one of T3 Code's providers and part of the author's own intro.
const CURSOR_ONLY = [
  /pstack-models\.mdc/, /\.cursor\//, /generalPurpose/, /AskQuestion/, /readonly: (true|false)/,
  /environment: "(cloud|local)"/, /cloud_base_branch/, /run_in_background/, /file_attachments/, /agent-transcripts/,
  /cursor-team-kit/, /\bdeslop\b/, /control-ui/, /control-cli/, /is_background/, /SendToUser/, /\bclaude-[a-z]+-\d/,
  /\bgemini-\d/, /(?<!codex\/)\bgpt-\d/, /-fast\b/, /`Task`/, /\bTask (tool|subagent|call)\b/, /\.cursor-plugin/, /docs\/harness/,
  /api2\.cursor\.sh/, /cursor\.com\/docs/, /custom mode/i, /Cursor Automations?/, /cloud agents?/i,
];

test("no Cursor-only names remain in the docs or skills", () => {
  const hits = [];
  for (const path of MARKDOWN) {
    readFileSync(path, "utf8").split("\n").forEach((line, i) => {
      for (const re of CURSOR_ONLY) if (re.test(line)) hits.push(`${relative(ROOT, path)}:${i + 1} ${re}`);
    });
  }
  assert.deepEqual(hits, []);
});

test("every relative link resolves", () => {
  const broken = [];
  for (const path of MARKDOWN) {
    for (const [, href] of readFileSync(path, "utf8").matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = href.replace(/[#?].*/, "");
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      if (!existsSync(resolve(dirname(path), target))) broken.push(`${relative(ROOT, path)} -> ${href}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("every skill's frontmatter name matches its folder", () => {
  for (const name of SKILL_NAMES) {
    const front = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    assert.equal(front.match(/^name:\s*(.*)$/m)?.[1].trim(), name);
  }
});

test("the default roles agree everywhere they are written", () => {
  const DEFAULTS = {
    "feature, refactoring": "opus high",
    "bug-fix": "opus high",
    "perf-issue": "opus high",
    hillclimb: "opus high",
    "judgment and prose": "opus xhigh",
    "arena runners": "opus high, fable medium",
    "arena cross-judge pool": "opus xhigh, fable medium",
    "swarm workers": "opus high",
    "interrogate reviewers": "opus xhigh, fable medium",
  };
  const setup = readFileSync(join(SKILLS, "setup-pstack", "SKILL.md"), "utf8");
  const block = setup.slice(setup.indexOf("```", setup.indexOf("### 5.")));
  const written = Object.fromEntries(
    [...block.matchAll(/^([a-z][a-z ,-]*): (.+)$/gm)].map(([, role, value]) => [role, value.trim()]),
  );
  assert.deepEqual(written, DEFAULTS);

  const read = (skill) => readFileSync(join(SKILLS, skill, "SKILL.md"), "utf8");
  assert.match(read("poteto-mode"), /Prose and judgment: `opus xhigh`/);
  assert.match(read("arena"), /opus high.*fable medium/s);
  assert.match(read("arena"), /opus xhigh.*fable medium/s);
  assert.match(read("swarm"), /opus high/);
  assert.match(read("interrogate") + read("poteto-mode"), /Interrogate reviewers: `opus xhigh`, `fable medium`/);
});

const run = (args, env = {}) =>
  spawnSync(process.execPath, [join(ROOT, "scripts", "install.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
const temp = (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "pstack-t3-test-")));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const isLink = (path) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

test("install links every skill into both project folders, and a rerun changes nothing", (t) => {
  const project = temp(t);
  assert.equal(run(["--project", project]).status, 0);
  for (const folder of [".agents/skills", ".claude/skills"]) {
    for (const name of SKILL_NAMES) {
      const path = join(project, folder, name);
      assert.ok(isLink(path), path);
      assert.equal(readlinkSync(path), join(SKILLS, name));
    }
  }
  const again = run(["--project", project]);
  assert.equal(again.status, 0);
  assert.doesNotMatch(again.stdout, /^(link|move|replace)/m);
});

test("install skips a skill it does not own unless --force, and never overwrites a backup", (t) => {
  const project = temp(t);
  const skills = join(project, ".claude", "skills");
  mkdirSync(join(skills, "bro"), { recursive: true });
  writeFileSync(join(skills, "bro", "SKILL.md"), "mine");
  symlinkSync(join(project, "elsewhere"), join(skills, "unslop"));
  writeFileSync(join(skills, "unslop.pre-pstack-t3"), "older backup");

  const plain = run(["--project", project, "--targets", "claude"]);
  assert.equal(plain.status, 0);
  assert.match(plain.stdout, /Skipped 2 skill/);
  assert.equal(readFileSync(join(skills, "bro", "SKILL.md"), "utf8"), "mine");

  const forced = run(["--project", project, "--targets", "claude", "--force"]);
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(readFileSync(join(skills, "bro.pre-pstack-t3", "SKILL.md"), "utf8"), "mine");
  assert.equal(readFileSync(join(skills, "unslop.pre-pstack-t3"), "utf8"), "older backup");
  assert.equal(readlinkSync(join(skills, "unslop.pre-pstack-t3-2")), join(project, "elsewhere"));
  assert.ok(isLink(join(skills, "bro")));
});

test("uninstall removes only its own links and restores the first backup", (t) => {
  const project = temp(t);
  const skills = join(project, ".claude", "skills");
  mkdirSync(join(skills, "bro"), { recursive: true });
  writeFileSync(join(skills, "bro", "SKILL.md"), "mine");
  mkdirSync(join(skills, "unrelated"));
  run(["--project", project, "--targets", "claude", "--force"]);

  const r = run(["--project", project, "--targets", "claude", "--uninstall"]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(skills).sort(), ["bro", "unrelated"]);
  assert.equal(readFileSync(join(skills, "bro", "SKILL.md"), "utf8"), "mine");
});

test("--dry-run changes nothing", (t) => {
  const project = temp(t);
  const r = run(["--project", project, "--dry-run"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^would link /m);
  assert.equal(existsSync(join(project, ".agents")), false);
});

test("user scope adds Antigravity only when ~/.gemini exists", (t) => {
  const home = temp(t);
  assert.equal(run([], { HOME: home }).status, 0);
  assert.ok(isLink(join(home, ".agents", "skills", "poteto-mode")));
  assert.ok(isLink(join(home, ".claude", "skills", "poteto-mode")));
  assert.equal(existsSync(join(home, ".gemini")), false);

  mkdirSync(join(home, ".gemini"));
  assert.equal(run([], { HOME: home }).status, 0);
  assert.ok(isLink(join(home, ".gemini", "config", "skills", "poteto-mode")));
});

test("install rejects an unknown target and a missing option value", (t) => {
  const project = temp(t);
  assert.notEqual(run(["--project", project, "--targets", "vscode"]).status, 0);
  assert.notEqual(run(["--project"]).status, 0);
});
