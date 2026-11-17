#!/usr/bin/env node
// Tests for the build, the install script, and the consistency of the T3 Code files. Run: node --test scripts/

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync,
  rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist", "pstack");
const SKILL_NAMES = readdirSync(join(DIST, "skills")).filter((n) => existsSync(join(DIST, "skills", n, "SKILL.md")));

const run = (script, args = [], env = {}) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const temp = (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "pstack-t3-test-")));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
// A copy of the repo whose sources a test can break without touching the real one.
const copyRepo = (t) => {
  const dir = temp(t);
  for (const part of ["scripts", "t3", "vendor", "UPSTREAM"]) cpSync(join(ROOT, part), join(dir, part), { recursive: true });
  return dir;
};
const isLink = (path) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

test("dist/pstack is up to date", () => {
  const r = run(join(ROOT, "scripts", "build.mjs"), ["--check"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("every adapter line points at a file that exists", () => {
  for (const name of SKILL_NAMES) {
    const text = readFileSync(join(DIST, "skills", name, "SKILL.md"), "utf8");
    if (!text.includes("T3 Code adapter")) continue;
    const href = text.match(/\[the T3 Code adapter\]\(([^)]+)\)/)[1];
    assert.ok(existsSync(resolve(DIST, "skills", name, href)), `${name}: ${href}`);
  }
});

test("a skill that names a Cursor-only concept carries the adapter line", () => {
  const cursorish = /pstack-models\.mdc|\.cursor\/|generalPurpose|subagent_type|AskQuestion|readonly: true|environment: "cloud"|Bugbot|`\/loop/;
  for (const name of SKILL_NAMES) {
    const dir = join(DIST, "skills", name);
    const files = readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".md"));
    const uses = files.some((f) => cursorish.test(readFileSync(join(dir, f), "utf8")));
    const skill = readFileSync(join(dir, "SKILL.md"), "utf8");
    if (uses && name !== "setup-pstack") assert.ok(skill.includes("T3 Code adapter"), name);
  }
});

test("default roles agree across the adapter, setup-pstack, and the README", () => {
  const block = (path, after) => {
    const text = readFileSync(join(ROOT, path), "utf8");
    const start = text.indexOf("```", text.indexOf(after)) + 3;
    return text.slice(start, text.indexOf("```", start)).split("\n").filter((l) => /^[a-z][a-z ,-]*: /.test(l)).join("\n");
  };
  const adapter = block("t3/adapter.md", "### Default roles");
  assert.ok(adapter.split("\n").length >= 9, adapter);
  assert.equal(block("t3/overrides/skills/setup-pstack/SKILL.md", "### 5. Write the file"), adapter);
  assert.equal(block("README.md", "## Default models"), adapter);
});

test("the build fails when the adapter loses a row a skill needs", (t) => {
  const dir = copyRepo(t);
  const adapter = join(dir, "t3", "adapter.md");
  writeFileSync(adapter, readFileSync(adapter, "utf8").replaceAll("`AskQuestion`", "`AskSomething`"));
  const r = run(join(dir, "scripts", "build.mjs"));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL t3\/adapter\.md has no row for `AskQuestion`/);
});

test("the build fails on a dangling link and on a skill name mismatch", (t) => {
  const dir = copyRepo(t);
  const skill = join(dir, "vendor", "pstack", "skills", "bro", "SKILL.md");
  writeFileSync(skill, readFileSync(skill, "utf8").replace("name: bro", "name: brother") + "\n[x](../nope/SKILL.md)\n");
  const r = run(join(dir, "scripts", "build.mjs"));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /skills\/bro\/SKILL\.md has name "brother"/);
});

test("the build points links to files it leaves out at the pinned upstream commit", () => {
  const sha = readFileSync(join(ROOT, "UPSTREAM"), "utf8").match(/tree\/([0-9a-f]{40})/)[1];
  const all = SKILL_NAMES.flatMap((n) =>
    readdirSync(join(DIST, "skills", n), { recursive: true })
      .filter((f) => f.endsWith(".md"))
      .map((f) => readFileSync(join(DIST, "skills", n, f), "utf8")),
  ).join("\n");
  for (const [, url] of all.matchAll(/\]\((https:\/\/github\.com\/cursor\/plugins\/[^)]+)\)/g)) {
    assert.ok(url.includes(sha), url);
  }
});

const install = (args, env) => run(join(ROOT, "scripts", "install.mjs"), args, env);

test("install links every skill into both project folders, and a rerun changes nothing", (t) => {
  const project = temp(t);
  assert.equal(install(["--project", project]).status, 0);
  for (const folder of [".agents/skills", ".claude/skills"]) {
    for (const name of SKILL_NAMES) {
      const path = join(project, folder, name);
      assert.ok(isLink(path), path);
      assert.equal(readlinkSync(path), join(DIST, "skills", name));
    }
  }
  const again = install(["--project", project]);
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

  const plain = install(["--project", project, "--targets", "claude"]);
  assert.equal(plain.status, 0);
  assert.match(plain.stdout, /Skipped 2 skill/);
  assert.equal(readFileSync(join(skills, "bro", "SKILL.md"), "utf8"), "mine");

  const forced = install(["--project", project, "--targets", "claude", "--force"]);
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
  install(["--project", project, "--targets", "claude", "--force"]);

  const r = install(["--project", project, "--targets", "claude", "--uninstall"]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(skills).sort(), ["bro", "unrelated"]);
  assert.equal(readFileSync(join(skills, "bro", "SKILL.md"), "utf8"), "mine");
});

test("--dry-run changes nothing", (t) => {
  const project = temp(t);
  const r = install(["--project", project, "--dry-run"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^would link /m);
  assert.equal(existsSync(join(project, ".agents")), false);
});

test("user scope adds Antigravity only when ~/.gemini exists", (t) => {
  const home = temp(t);
  assert.equal(install([], { HOME: home }).status, 0);
  assert.ok(isLink(join(home, ".agents", "skills", "poteto-mode")));
  assert.ok(isLink(join(home, ".claude", "skills", "poteto-mode")));
  assert.equal(existsSync(join(home, ".gemini")), false);

  mkdirSync(join(home, ".gemini"));
  assert.equal(install([], { HOME: home }).status, 0);
  assert.ok(isLink(join(home, ".gemini", "config", "skills", "poteto-mode")));
});

test("install rejects an unknown target and a missing option value", (t) => {
  const project = temp(t);
  assert.notEqual(install(["--project", project, "--targets", "vscode"]).status, 0);
  assert.notEqual(install(["--project"]).status, 0);
});
