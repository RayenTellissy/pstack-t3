# pstack for T3 Code

[pstack](https://github.com/cursor/plugins/tree/main/pstack) is poteto's set of rigorous agent workflows: `poteto-mode` and its playbooks, review panels (`arena`, `interrogate`, `swarm`), explainers (`how`, `why`, `teach`), and twenty-four principle skills. Upstream targets Cursor, with a Claude Code adapter.

This repo runs pstack in [T3 Code](https://github.com/pingdotgg/t3code), on whatever provider a thread uses: Claude, Codex, Cursor, OpenCode, Pi, Antigravity, or Grok.

## What changes in T3 Code

The skills stay word-for-word upstream. A T3 Code adapter, [`t3/adapter.md`](t3/adapter.md), maps each Cursor name to T3 Code, and the build adds one line to every skill that uses a Cursor name, telling the agent to read the adapter first. The main mappings:

| pstack needs | T3 Code gives it |
| --- | --- |
| Subagents on a chosen model | `delegate_task` to any provider instance and model, after one `orchestrator_capabilities` call |
| Review panels | One child per panel seat, on any provider. The defaults are Opus and Fable; add a Codex or Antigravity seat for cross-vendor review |
| Cloud agents | `isolation: "worktree"`, or a linked environment on another machine |
| Transcript mining (`recall`, `correct`, `automate-me`) | `t3_thread_search`, `t3_thread_list`, `t3_thread_read` across all providers |
| Cursor Automations, `/loop` | `schedule_task` (interval, cron time, or webhook) |
| PR tool, babysitting | `gh pr create`, then `link_pull_request` and `watch_pull_request` |
| `control-ui` | `preview_*` browser tools, and `device_*` for simulators |
| Visuals | `html_preview` and `html_render` in the thread |
| Model config rule | `~/.pstack/t3-models.md`, written by a T3 Code version of `setup-pstack` |

`setup-pstack` is the one rewritten skill ([`t3/overrides/skills/setup-pstack`](t3/overrides/skills/setup-pstack/SKILL.md)). It detects models with `orchestrator_capabilities` and writes values such as `opus high`, or `codex/gpt-6.1-sol high` for another provider.

## Default models

With no config file, every role runs on these, in place of the slugs written in the upstream skills:

```
feature, refactoring: opus high
bug-fix: opus high
perf-issue: opus high
hillclimb: opus high
judgment and prose: opus xhigh
arena runners: opus high, fable medium
arena cross-judge pool: opus xhigh, fable medium
swarm workers: opus high
interrogate reviewers: opus xhigh, fable medium
```

These change only which model a step runs on; every skill runs as upstream wrote it, with one exception: when your thread runs on Opus, `arena` runs two Claude judges (`opus xhigh` and `fable medium`) instead of skipping its cross-vendor judge.

Not ported: the benny automation pack (it is built on Cursor Automations and Slack; `schedule_task` webhooks could host it later) and Bugbot-specific steps, which the adapter skips with a one-line note.

## Install

Requires Node 20 or later.

```bash
git clone https://github.com/RayenTellissy/pstack-t3.git
cd pstack-t3
node scripts/install.mjs
```

This links every skill into `~/.agents/skills` (Codex, Cursor, OpenCode, Pi), `~/.claude/skills` (Claude), and `~/.gemini/config/skills` (Antigravity, when `~/.gemini` exists). The links point into this checkout, so `git pull` updates them.

Options:

- `--project <dir>` installs into `<dir>/.agents/skills` and `<dir>/.claude/skills` instead.
- `--targets agents,claude` limits the folders.
- `--dry-run` prints what it would do.
- `--force` moves an existing skill with the same name, such as one from an earlier pstack install, to `<name>.pre-pstack-t3` (`-2`, `-3`, and so on if that name is taken). Without it, those skills are skipped and listed.
- `--uninstall` removes only links that point into this checkout, and moves `<name>.pre-pstack-t3` back into place.

Then in T3 Code:

1. Run **Restart agent session** from the command palette.
2. Send `$setup-pstack` to pick models per role.
3. Start a task with `$poteto-mode`.

If you also have the upstream Claude Code plugin installed, its skills show as `pstack:<name>`. They read the Claude Code adapter instead, so use the unprefixed ones in T3 Code.

## Layout

```
vendor/pstack/      upstream pstack, unmodified, at the commit in UPSTREAM
t3/adapter.md       the T3 Code adapter
t3/overrides/       files that replace upstream ones (setup-pstack)
dist/pstack/        generated and committed: what install.mjs links
scripts/            sync-upstream, build, install
```

## Update from upstream

```bash
node scripts/sync-upstream.mjs          # or pass a ref
node scripts/build.mjs
```

The build fails when an upstream skill starts using a Cursor name the adapter has no row for, or links to a file that does not exist. Add the row to `t3/adapter.md`, rebuild, and commit `vendor/`, `dist/`, and `UPSTREAM` together. CI runs `node scripts/build.mjs --check` and fails while `dist/` is stale.

## License

MIT. pstack is by Lauren Tan; see [LICENSE](LICENSE).
