#!/usr/bin/env node
// Generate dist/pstack from vendor/pstack and t3/. `--check` fails when dist/ is stale instead of writing it.

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PSTACK = join(ROOT, "vendor", "pstack");
const OVERRIDES = join(ROOT, "t3", "overrides");
const OUT = join(ROOT, "dist", "pstack");
const ADAPTER = "docs/harness/t3-code.md";
const COMMAND = "node scripts/build.mjs";
const UPSTREAM = readFileSync(join(ROOT, "UPSTREAM"), "utf8").trim().replace(/\/pstack$/, "");
const LINK = /\]\(([^)\s]+)\)/g;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Each Cursor name a skill can use, and the adapter text that must map it.
const TERMS = [
  { key: "`Task`", re: /`Task`|\bTask (tool|subagent|call)/ },
  { key: "`AskQuestion`", re: /AskQuestion/ },
  { key: "todolist", re: /\btodo ?list\b/i },
  { key: "generalPurpose", re: /generalPurpose/ },
  { key: "poteto-agent", re: /poteto-agent/ },
  { key: "comment-sicko", re: /comment-sicko/ },
  { key: "`readonly: true`", re: /readonly: (true|false)|readonly\/Ask/ },
  { key: "`environment: \"cloud\"`", re: /environment: "(cloud|local)"/ },
  { key: "cloud_base_branch", re: /cloud_base_branch/ },
  { key: "`run_in_background: true`", re: /run_in_background/ },
  { key: "`resume`", re: /`resume`/ },
  { key: "`file_attachments`", re: /file_attachments/ },
  { key: "claude-", re: /\bclaude-[a-z]+-\d/ },
  { key: "grok-", re: /\bgrok-\d/ },
  { key: "gpt-", re: /\bgpt-\d/ },
  { key: "gemini-", re: /\bgemini-\d/ },
  { key: "inherit-parent", re: /inherit-parent/ },
  { key: "pstack-models.mdc", re: /pstack-models\.mdc/ },
  { key: ".cursor/skills/", re: /\.cursor\/skills/ },
  { key: "~/.cursor/plugins/", re: /\.cursor\/plugins|\.cursor-plugin/ },
  { key: ".cursor/rules/", re: /\.cursor\/rules|always-applied rule/ },
  { key: "agent-transcripts", re: /agent-transcripts|\.cursor\/projects/ },
  { key: "`/loop`", re: /`\/loop/ },
  { key: "`/deslop`", re: /deslop/ },
  { key: "`control-ui`", re: /control-ui/ },
  { key: "`control-cli`", re: /control-cli/ },
  { key: "`SendToUser`", re: /SendToUser/ },
  { key: "`/create-skill`", re: /\/create-skill/ },
  { key: "Cursor-only features", re: /Bugbot|Cursor [Aa]utomation|cursor\.(sh|com)\/automations|[Cc]loud [Aa]gent|built-in PR tool/ },
];
const ROUTE_KEY = "Run another pstack skill";

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const file = (path) => ({ bytes: readFileSync(path), executable: (statSync(path).mode & 0o111) !== 0 });

// Overrides replace the upstream file at the same pstack-relative path.
const sources = new Map();
for (const dir of ["skills", "agents", "docs/guide"]) {
  for (const path of walk(join(PSTACK, dir))) sources.set(relative(PSTACK, path), file(path));
}
const overridden = new Set();
for (const path of walk(OVERRIDES)) {
  const rel = relative(OVERRIDES, path);
  sources.set(rel, file(path));
  overridden.add(rel);
}
sources.set(ADAPTER, file(join(ROOT, "t3", "adapter.md")));
sources.set("README.md", file(join(PSTACK, "README.md")));
sources.set("LICENSE", file(join(PSTACK, "LICENSE")));

const text = (path) => sources.get(path).bytes.toString("utf8");
const skills = [...sources.keys()]
  .filter((path) => /^skills\/[^/]+\/SKILL\.md$/.test(path))
  .map((path) => path.split("/")[1])
  .sort();

// A skill the adapter's role table changes must read the adapter even when it uses no Cursor names.
const roleSection = text(ADAPTER).match(/^### Where each role applies\n([\s\S]*?)(?=^#)/m)?.[1];
if (!roleSection) throw new Error("t3/adapter.md has no `### Where each role applies` section");
const roleSkills = new Set(skills.filter((skill) => roleSection.includes(`\`${skill}\``)));

const problems = [];
const users = new Map();
const wraps = new Set();
for (const skill of skills) {
  const skillMd = `skills/${skill}/SKILL.md`;
  const frontmatter = text(skillMd).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const name = frontmatter.match(/^name:(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  if (name !== skill) problems.push(`${skillMd} has name ${JSON.stringify(name ?? "")}, not its folder name`);
  if (!SKILL_NAME.test(skill) || skill.length > 64) problems.push(`skills/${skill} is not a valid skill name`);
  if (overridden.has(skillMd)) continue;

  const others = skills.filter((s) => s !== skill).join("|");
  const route = new RegExp(`the \\*\\*(?<bold>${others})\\*\\* skill|\`/(?<command>${others})\``, "g");
  const namesBareSkill = (line) =>
    [...line.matchAll(route)].some(({ groups }) => !line.includes(`(../${groups.bold ?? groups.command}/`));
  const used = new Set();
  for (const path of [...sources.keys()].filter((p) => p.startsWith(`skills/${skill}/`) && p.endsWith(".md"))) {
    const body = text(path);
    for (const term of TERMS) if (term.re.test(body)) used.add(term.key);
    if (body.split("\n").some(namesBareSkill)) used.add(ROUTE_KEY);
  }
  if (used.size === 0 && !roleSkills.has(skill)) continue;
  if (!/^# /m.test(text(skillMd))) problems.push(`${skillMd} needs the adapter line but has no H1`);
  wraps.add(skill);
  for (const key of used) users.set(key, [...(users.get(key) ?? []), skill]);
}
const adapter = text(ADAPTER);
for (const [key, using] of users) {
  if (!adapter.includes(key)) problems.push(`t3/adapter.md has no row for ${key}, used by ${using.join(", ")}`);
}
for (const problem of problems) console.log(`FAIL ${problem}`);
if (problems.length > 0) process.exit(1);

const ADAPTER_LINE =
  `In T3 Code, read [the T3 Code adapter](../../${ADAPTER}) once per session before you follow this skill. ` +
  "It maps the Cursor names in pstack skills to T3 Code's tools and your provider. " +
  "This skill folder may be a symlink: resolve this file's real path first, and the adapter is two folders up from its folder.";
for (const skill of wraps) {
  const path = `skills/${skill}/SKILL.md`;
  sources.get(path).bytes = Buffer.from(text(path).replace(/^(# .*)\n+/m, `$1\n\n${ADAPTER_LINE}\n\n`));
}

// A relative link to an upstream file the tree leaves out points at the pinned upstream commit instead.
const has = (path) => sources.has(path) || [...sources.keys()].some((key) => key.startsWith(`${path}/`));
const dangling = [];
for (const [path, entry] of sources) {
  if (!path.endsWith(".md")) continue;
  const body = entry.bytes.toString("utf8").replace(LINK, (link, href) => {
    const target = href.replace(/[#?].*/, "");
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return link;
    const resolved = posix.join(posix.dirname(path), target).replace(/\/$/, "");
    if (resolved.startsWith("..") || has(resolved)) return link;
    if (!existsSync(join(PSTACK, resolved))) {
      dangling.push(`${path} links to ${href}, which exists neither in the tree nor upstream`);
      return link;
    }
    const kind = statSync(join(PSTACK, resolved)).isDirectory() ? "tree" : "blob";
    return `](${UPSTREAM.replace("/tree/", `/${kind}/`)}/pstack/${resolved}${href.slice(href.search(/[#?]|$/))})`;
  });
  entry.bytes = Buffer.from(body);
}
for (const link of dangling) console.log(`FAIL ${link}`);
if (dangling.length > 0) process.exit(1);

if (process.argv.includes("--check")) {
  const onDisk = new Map(walk(OUT).map((path) => [relative(OUT, path), file(path)]));
  const drifted = [...new Set([...sources.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [sources.get(path), onDisk.get(path)];
    return !want || !have || !want.bytes.equals(have.bytes) || want.executable !== have.executable;
  });
  for (const path of drifted.slice(0, 20)) console.log(`dist/pstack/${path}`);
  if (drifted.length > 0) {
    console.log(`dist/pstack is out of date. Run \`${COMMAND}\` and commit the result.`);
    process.exit(1);
  }
  console.log("dist/pstack is up to date.");
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [path, { bytes, executable }] of sources) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), bytes);
    chmodSync(join(OUT, path), executable ? 0o755 : 0o644);
  }
  console.log(`${skills.length} skills, ${wraps.size} with the adapter line, ${overridden.size} overridden file(s)`);
}
