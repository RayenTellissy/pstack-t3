# pstack in T3 Code

pstack skills use Cursor names. In T3 Code, read this file once per session, then map each Cursor name in a skill with the tables below. T3 Code runs many providers (Claude, Codex, Cursor, Grok, OpenCode, Antigravity, Pi, and others), so the agent reading this may be any of them. The `t3-code` MCP server is the common layer: use its tools wherever a row names one, and use your own provider's native tool only where a row says so.

`<pstack>` means the folder that holds `skills/` and `docs/`. Skills are often installed as symlinks, so resolve the real path of the `SKILL.md` you were given (`realpath`), then go up two folders. If a Cursor field has no row, drop it and say so. Never pass a field or value a tool schema rejects. T3 Code's MCP tools can load late: if one is deferred, load it with your tool-search tool and try it once before you call it absent.

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
| `Task` with no `model`, or a role set to `inherit-parent` or `auto` | Your provider's native subagent tool (`Agent` in Claude with `run_in_background: false`, `spawn_agent` then wait in Codex). Without one, `delegate_task` with no `target`. |
| `subagent_type: generalPurpose` | Drop it. `delegate_task` children are general-purpose. With a native tool, use its general type (`general-purpose` in Claude). |
| `poteto-agent` | `delegate_task` whose `task` starts with the body of `<pstack>/agents/poteto-agent.md` (below its frontmatter), then the absolute path of `<pstack>/skills/poteto-mode/SKILL.md`, then the brief. The child reads that path; it does not search `~/.cursor/plugins/`. Ignore the file's `model:` line: the target comes from the delegate's role in Default roles. |
| `comment-sicko` | `delegate_task` with `role: "review"` whose `task` is the body of `<pstack>/agents/comment-sicko.md`, then the scope. Its first output line is part of the persona, not an error. |
| `readonly: true` | `role: "research"` or `"review"`, and the brief says "do not edit files". Do not narrow `runtimeMode` for this: a narrow mode pauses for human approval, it is not read-only. Run `git status` afterward. |
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

## Models

A pstack role value in T3 Code is one of:

- `<family> <effort>`, such as `opus high` or `fable medium`. The family is a Claude family (`opus`, `sonnet`, `haiku`, `fable`): use a `claudeAgent` instance with `canRunChildTask` and its newest listed `claude-<family>-*` model.
- `<providerInstanceId>/<model> <effort>`, such as `codex/gpt-6.1-sol high`, for any provider.
- `inherit-parent` or `auto`: run on the parent thread's model.

The effort is the last token. Add `fast` after it to set `fastMode: true` where the model offers it.

### Default roles

These are pstack's defaults in T3 Code. They replace every default model slug written in the skills, including `poteto-mode`'s Subagents section, `arena`, `swarm`, `interrogate`, and the `model:` line in `poteto-agent`. A line in `~/.pstack/t3-models.md` overrides its role here.

```
feature, refactoring: opus high
bug-fix: opus high
perf-issue: opus high
hillclimb: opus high
judgment and prose: opus xhigh
hardest tasks: opus xhigh
how explorer: haiku high
how explainer: opus high
why investigators: opus high
why synthesizer: opus xhigh
reflect tooling: opus medium
reflect judgment, divergent, synthesizer: opus xhigh
arena runners: opus high, fable medium
arena cross-judge pool: opus xhigh, fable medium
swarm workers: opus high
architect runners: opus xhigh, fable medium
interrogate reviewers: opus xhigh, fable medium
```

### Where each role applies

The skills read some of these roles themselves. For the rest, spawn as this table says.

| Role | Used for |
| --- | --- |
| `feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb` | `poteto-mode` code delegates for that playbook, as the skill says. |
| `judgment and prose` | `poteto-mode` prose and judgment delegates. |
| `hardest tasks` | Where `poteto-mode` says to raise a role a step for the hardest or subtlest work, run that delegate on `hardest tasks` instead. |
| `swarm workers` | `swarm` workers, verification, and trivial mechanical edits, as the skills say. |
| `arena runners`, `interrogate reviewers` | One child per entry, as `arena` and `interrogate` say. |
| `arena cross-judge pool` | The `arena` judge: the first entry from a vendor other than the parent's. When every entry shares the parent's vendor, use the first entry and say the judge is not cross-vendor. |
| `how explorer`, `how explainer` | `how` step 1 runs as two children. The explorer (`role: "research"`, no edits) maps the files, entry points, and runtime flow behind the question and returns paths with line numbers and short excerpts. The explainer gets the question, the explorer's report, and the step 1 brief, reads what it needs, and writes the explanation. For a question one file answers, skip the explorer. |
| `why investigators`, `why synthesizer` | `why` delegates. Spawn one investigator per lead (the change that introduced the target, each later change that altered it, outside sources when the trail is thin), each told to return quoted, cited evidence and no conclusion. Then one synthesizer gets the question and every report and writes the answer under the skill's rules. A target with one short trail skips the investigators. |
| `reflect tooling` | `reflect`: one child reads the transcript (`t3_thread_read` with `view: "activity"`, paging back through `earlierPosition`) and returns candidate findings with quotes, plus the skills the session used. |
| `reflect judgment, divergent, synthesizer` | `reflect`: a judgment child applies the skill's keep and drop rules to the candidates; a divergent child argues for the strongest dropped candidates and for skills that should have fired; a synthesizer merges both into Accepted, Rejected, and Backlog. You present that and wait for approval. |
| `architect runners` | `architect`: one child per entry sketches one of the two shapes, each told to differ from the other on types, signatures, or module boundaries. You pick between them by the skill's rule. The large-design path still goes to `arena`. |

### Mapping Cursor slugs

| Cursor | T3 Code |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh-fast` | Use the role's value from Default roles. With no role, a `claudeAgent` instance with `canRunChildTask`, `model: "claude-<family>-<version>"`, `options: { effort: "<effort>" }`, and `-fast` dropped. |
| `gpt-*` | A `codex` instance, the named model or its closest listed model, `options: { reasoningEffort: "<effort>" }`. |
| `grok-*` | A `grok` instance. Pass the effort only if the model lists an effort option. |
| `gemini-*` | An `antigravity` instance with the closest Gemini model. When none can run a child task, give the seat to a model from a vendor the panel does not already have (usually Codex), because the seat exists for vendor diversity. Say which model took it. |
| `auto` or `inherit-parent` | Omit `target`, or use your native subagent tool. |
| Any option name | Use the effort-like option id the model lists in `orchestrator_capabilities` (`effort`, `reasoningEffort`). Never send an option the model does not list. |
| `pstack-models.mdc`, `~/.cursor/rules/pstack-models.mdc` | `~/.pstack/t3-models.md`. No provider loads it on its own: read it at the start of any skill that picks a model. If the file or the role's line is missing, use the role's value from Default roles. |

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
