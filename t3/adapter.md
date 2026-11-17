# pstack in T3 Code

pstack skills use Cursor names. In T3 Code, read this file once per session, then map each Cursor name in a skill with the tables below. T3 Code runs many providers (Claude, Codex, Cursor, Grok, OpenCode, Antigravity, Pi, and others), so the agent reading this may be any of them. The `t3-code` MCP server is the common layer: use its tools wherever a row names one, and use your own provider's native tool only where a row says so.

`<pstack>` means the folder that holds `skills/` and `docs/`. Skills are often installed as symlinks, so resolve the real path of the `SKILL.md` you were given (`realpath`); `<pstack>` is `../..` from the folder that holds it. If a Cursor field has no row, drop it and say so. Never pass a field or value a tool schema rejects. T3 Code's MCP tools can load late: if one is deferred, load it with your tool-search tool and try it once before you call it absent.

## Tools

| Cursor | T3 Code |
| --- | --- |
| `Task` | See Subagents below. |
| `AskQuestion` | Your provider's structured question tool (`AskUserQuestion` in Claude, `request_user_input` in Codex). T3 Code renders it in the composer. Without one, ask in plain text. A login, token, PIN, or password goes through `request_secret`, never a chat question. |
| Open a todolist, or copy steps into the todolist tool | Your provider's todo tool (`TodoWrite` in Claude, `update_plan` in Codex). Without one, keep the list in your reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | `Read` `<pstack>/skills/<name>/SKILL.md` and follow it. Do not depend on your provider's skill tool: many refuse skills marked for manual use. When you tell the user to type it, write `$<name>` (T3 Code's composer skill picker, any provider) or `/<name>` (the slash menu). |
| `Grep`, `Glob` | `rg` in your shell when your provider has no search tool. |
| Cursor's `/loop` | `schedule_task` with an interval and `bindToCurrentThread: true`, plus a done predicate in its prompt that every tick can check; delete it with `delete_scheduled_task` when the predicate passes. Claude's own `/loop` also works inside a Claude thread. To wait on background work you started, use `t3_background_wait`, never a loop. |
| Custom mode (option+enter keeps a skill on every turn) | No equivalent. Add the skill again with `$poteto-mode` on each message, or put "use poteto-mode for every task in this thread" in the first message. |
| `/deslop` from `cursor-team-kit` | The **unslop** skill over the diff, then **no-comments**. |
| `control-ui` from `cursor-team-kit` | T3 Code's `preview_*` tools (`preview_open`, `preview_navigate`, `preview_act`, `preview_snapshot`, `preview_evaluate`, `preview_recording_start`) for web and Electron renderers. iOS Simulator and Android Emulator: `device_list`, `device_open`, then the command it returns, and `device_screenshot`. Close tabs you opened before you reply. |
| `control-cli` from `cursor-team-kit` | Your shell, with a PTY tool such as `tmux` or `expect` for TUIs. |
| A visual in the reply (diagram, statechart, chart, ketchup slide) | Write an HTML file, then `html_preview` and `html_render` so it shows in the thread. A file on disk alone does not show it. Mermaid goes inside the HTML. |

## Subagents

T3 Code gives every provider one delegation tool, `delegate_task`, which creates a child thread on any provider instance and model. That is what makes pstack's multi-model panels work here: a Fable runner, an Opus runner, and a GPT runner can all be children of the same thread.

Call `orchestrator_capabilities` once per thread before the first `delegate_task`. It lists each provider instance, its models, each model's options, and whether it `canRunChildTask`. Call it again only after an error.

| Cursor | T3 Code |
| --- | --- |
| `Task` with a `model` (any pstack role with a real model) | `delegate_task` with `target: { providerInstanceId, model, options }` mapped with the Models table. One call per panel seat. |
| `Task` with no `model`, or a role set to `inherit-parent` or `auto` | Your provider's native subagent tool (`Agent` in Claude with `run_in_background: false`, `spawn_agent` then wait in Codex). Without one, `delegate_task` with no `target`. Native subagents run in the foreground even when the skill says `run_in_background: true`; when the step needs the work to run in the background, use `delegate_task` with no `target`. |
| `subagent_type: generalPurpose` | Drop it. `delegate_task` children are general-purpose. With a native tool, use its general type (`general-purpose` in Claude). |
| `poteto-agent` | `delegate_task` whose `task` starts with the body of `<pstack>/agents/poteto-agent.md` (below its frontmatter), then the absolute path of `<pstack>/skills/poteto-mode/SKILL.md`, then the brief. The child reads that path; it does not search `~/.cursor/plugins/`. Ignore the file's `model:` line: the target comes from the delegate's role in Default roles. |
| `comment-sicko` | `delegate_task` with `role: "review"` whose `task` is the body of `<pstack>/agents/comment-sicko.md`, then the scope. Its first output line is part of the persona, not an error. |
| `readonly: true` | With `delegate_task`: `role: "research"` or `"review"`. With Claude's native `Agent`: `subagent_type: "Explore"`. Other native tools, such as Codex's `spawn_agent`, have no read-only field. In every case the brief says "do not edit files", and you run `git status` afterward. Do not narrow `runtimeMode` for this: a narrow mode pauses for human approval, it is not read-only. |
| `readonly: false` | Default. |
| `environment: "cloud"` | `isolation: "worktree"`, which gives the child its own prepared checkout from your commit. Uncommitted edits do not carry over, so commit first or say so. To run on another machine, `t3_environment_links` lists linked environments; pass one's `environmentId` in `target`. |
| `environment: "local"` | Omit (`isolation: "shared"` is the default). |
| `cloud_base_branch: <b>` | The brief tells the child to check out `<b>` first. For a whole new top-level thread on `<b>`, use `t3_thread_launch` with `workspaceStrategy` `worktree` and `baseRef: <b>`. |
| `run_in_background: true` | Default. `delegate_task` returns at once, and a result with `next` wakes your thread when the child finishes. Do not poll (`task_status`, sleep, loops). Use `mode: "wait"` only when this turn cannot continue without the result. |
| `resume` | A follow-up that needs the same child's conversation: `t3_thread_send` to its `childThreadId`. A new review round or re-check: a new `delegate_task` with the original brief, prior findings, and open objections, and a new `clientRequestId`. |
| `file_attachments` | List absolute paths in the brief. For images the child must see, `t3_thread_send_attachments` to its `childThreadId`. |
| Cancel a subagent | `task_cancel`, never `t3_thread_interrupt` on a `childThreadId`. |
| A child's pending question | When a result has `hasPendingQuestion`, read it with `t3_pending_request` on the `childThreadId`, then answer it or ask the user. |

Link a child thread in your reply by the `link` its result carries, verbatim.

T3 Code tells child threads to do their work themselves and start no subagents unless their task says to. When a brief asks a child to run a pstack skill or step that spawns subagents, say in the brief that it may spawn them.

## Models

A pstack role value in T3 Code is one of:

- `<family> <effort>`, such as `opus high` or `fable medium`. The family is a Claude family (`opus`, `sonnet`, `haiku`, `fable`): use a `claudeAgent` instance with `canRunChildTask` and its newest listed `claude-<family>-*` model.
- `<providerInstanceId>/<model> <effort>`, such as `codex/gpt-6.1-sol high`, for any provider.
- `inherit-parent` or `auto`: run on the parent thread's model.

The effort is the last token. Add `fast` after it to set `fastMode: true` where the model offers it. Without `fast`, leave `fastMode` off, even where a skill says Opus always runs its `-fast` slug.

### Default roles

These are pstack's defaults in T3 Code. They replace the default model slugs written in the skills, including `poteto-mode`'s Subagents section, `arena`, `swarm`, `interrogate`, and the `model:` line in `poteto-agent`. They change only which model a step runs on, never how the skill runs. A line in `~/.pstack/t3-models.md` overrides its role here.

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

### Which roles the skills read

The skills read every role above and use each exactly as they say. These values only change which model runs, with one exception for the arena judge below. Ignore any other role line in `~/.pstack/t3-models.md`.

### Arena judges on an Opus parent

`arena` picks one judge from the `arena cross-judge pool` and never from the parent's vendor. When your own model is a Claude Opus model, waive that vendor rule for the Claude entries: spawn one judge for each of the first two Claude entries in the pool (by default `opus xhigh` and `fable medium`), in parallel, with the same brief. Each scores every candidate on every rubric criterion and recommends a base, as the skill says. Read both. Where they disagree on the base or on a criterion, say so and decide yourself. On any other parent model, follow the skill's one-judge rule unchanged.

### Mapping Cursor slugs

| Cursor | T3 Code |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh-fast` | Use the role's value from Default roles. With no role, a `claudeAgent` instance with `canRunChildTask`, `model: "claude-<family>-<version>"`, `options: { effort: "<effort>" }`, and `-fast` dropped. |
| `gpt-*` | A `codex` instance, the named model or its closest listed model, `options: { reasoningEffort: "<effort>" }`. |
| `grok-*` | A `grok` instance. Pass the effort only if the model lists an effort option. |
| `gemini-*` | An `antigravity` instance with the closest Gemini model. When none can run a child task, give the seat to a model from a vendor the panel does not already have (usually Codex), because the seat exists for vendor diversity. Say which model took it. |
| `auto` or `inherit-parent` | Omit `target`, or use your native subagent tool. |
| Any option name | Use the effort-like option id the model lists in `orchestrator_capabilities` (`effort`, `reasoningEffort`). Never send an option the model does not list. |
| `pstack-models.mdc`, `~/.cursor/rules/pstack-models.mdc` | `~/.pstack/t3-models.md`. No provider loads it on its own: read it at the start of any skill that picks a model. If the file or the role's line is missing, use the role's value from Default roles. Never read `~/.cursor/rules/pstack-models.mdc` in T3 Code; if it exists and the T3 Code file does not, tell the user once that `$setup-pstack` writes the T3 Code file. The `# defaults: 3` check in `poteto-mode` is about the Cursor file; skip it. |

If `delegate_task` rejects a target, never pass it again. Fall back as the skill says, then to the closest model of the same family that `orchestrator_capabilities` lists, then omit `target`. Say so.

## Paths

| Cursor | T3 Code |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.agents/skills/` and `~/.agents/skills/` (read by Codex, Cursor, OpenCode, and Pi), plus `.claude/skills/` and `~/.claude/skills/` for Claude, and `~/.gemini/config/skills/` for Antigravity. Write a new project skill to `.agents/skills/<name>/` and symlink it into `.claude/skills/<name>`. After adding skills, use **Restart agent session** in the command palette. |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | `<pstack>`. pstack for T3 Code is not a plugin; `install.mjs` links its skills into the folders above. |
| `.cursor/rules/*.mdc`, always-applied rules | `AGENTS.md`, plus `CLAUDE.md` when the project has one. The model rule is the exception. See Models. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `<pstack>/<path>` when that file exists. Read the local copy and never fetch it. Give the user the URL when they need a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | T3 Code's thread history, which covers every provider: `t3_thread_search` (title, branch, PR, then message text), `t3_thread_list` (one project, newest first), and `t3_thread_read` with `view: "activity"` for tool calls. Read bounded pages and follow `earlierPosition`. Never open `~/.t3/userdata` directly; it is the user's live database. |

## Cursor-only features

When a step needs a feature with no T3 Code equivalent, put one line in your reply, `Skipped in T3 Code: <step>. <reason>.`, then go on. Do not stop, ask, or retry. When a later step needs what the skipped step made, leave a placeholder and name it in the line.

| Cursor | T3 Code |
| --- | --- |
| Cursor Automations: routines, routine wakes, `api2.cursor.sh/automations` webhooks | `schedule_task`. It runs a prompt on an interval, at a time, or on each webhook request, bound to this thread or launching a fresh one per run. Set a webhook signature when the sender supports one. `update_state` routine calls have no equivalent: keep state in a file the prompt reads. |
| `SendToUser` secret requests | `request_secret`. |
| Bugbot | Bugbot comments on a GitHub PR are ordinary review threads, so triage them with the forge command the step gives. Skip a step that starts, waits for, or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor cloud agents | `environment: "cloud"` maps to a worktree or a linked environment, as in Subagents. Skip a step that needs the cloud agent itself, such as its dashboard. |
| A built-in PR tool | `gh pr create` (or the forge command the step gives), then `link_pull_request` with the full URL. To babysit or wait on checks, `watch_pull_request` and end the turn; do not loop or `gh --watch`. `unwatch_pull_request` before you hand back. |
| `/create-skill` | Follow the **authoring a skill** playbook and write to the project skill folder from Paths. |
