---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget. Detects the provider instances and models T3 Code can run and writes a model file that overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `~/.pstack/t3-models.md`, the file that sets pstack's model per role. Every pstack skill that picks a model reads it and falls back to the skill default for a missing role.

A role value is `<family> <effort>` for a Claude family (`opus`, `sonnet`, `haiku`, `fable`), such as `opus high`, or `<providerInstanceId>/<model> <effort>` for any provider, such as `codex/gpt-6.1-sol high`. `inherit-parent` and `auto` run the role on the parent thread's model. The Subagents section of the **poteto-mode** skill says how a value resolves to a `delegate_task` target.

## Steps

### 1. Detect available models

Call `orchestrator_capabilities`. The detected set is every `(providerInstanceId, model id)` pair whose provider has `canRunChildTask: true`, each with the efforts its effort option lists (`effort` or `reasoningEffort`). A model with no effort option is written with effort `default`. Use `search` to find a model the short list omits when the user names one. Never write a model you have not confirmed is in the detected set. `inherit-parent` and `auto` are always valid.

Tell the user, one line each, which provider instances cannot run child tasks and why, from their `constraints`. Enabling one in **Settings > Providers** and running this skill again makes it available.

### 2. Load current state

The default mapping is the file shape in step 5. If `~/.pstack/t3-models.md` exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from the defaults. Drop a line whose role is not in step 5 and tell the user.

A family value such as `opus high` is detected when a `claudeAgent` instance that can run a child task lists a `claude-<family>-*` model with that effort. Mark any value that is not detected as needing a choice. With no Claude instance able to run child tasks, every default needs a choice, so offer the detected models.

The default panels (`arena runners`, `arena cross-judge pool`, `interrogate reviewers`) are Claude-only. When another vendor can run child tasks, mention once that adding it as a panel entry gives cross-vendor review, and leave the panels as they are unless the user asks.

### 3. Budget, map, and confirm

**(a) Ask for a budget** with your question tool, else in plain text. Offer these labels, and name the current budget when the file records one. With no file, say that `large` matches the skill defaults.

- `large — default reasoning`
- `medium — one step lower`
- `small — two steps lower`

**(b) Apply it.** Build the working table from the defaults, and on a re-run keep any role the user changed by model, family, list, or alias (`inherit-parent`, `auto`). A different effort alone is not a change. Then move the effort of every real entry by the budget, kept roles and panel entries included, one entry at a time, so a panel keeps its mix. An entry starts from the default effort of the seat in the same position of its role's default list, or the last seat when the list is longer. `large` keeps it, `medium` lowers it one step, and `small` lowers it two, on the ladder `xhigh` > `high` > `medium` > `low`. No entry runs above `xhigh`, and an entry at the bottom stays at `low`. So `medium` turns `arena runners: opus high, fable medium` into `opus medium, fable low`, and `judgment and prose: opus xhigh` into `opus high`. The effort is the last token, or the one before a trailing `fast`, and a trailing `fast` stays. If the model does not list that effort, use its highest listed effort at or below it. `inherit-parent`, `auto`, and `default` efforts do not change.

**(c) Show the roles and confirm.** Show every role and its value, mark each one needing a choice, and list the lines step 2 dropped. Ask whether to accept or change specific roles, offering the detected models at `xhigh` or below plus `inherit-parent` and `auto`. Panel roles (`arena runners`, `interrogate reviewers`) are lists, and one child runs per entry, so the length sets the count. `arena cross-judge pool` is a list in preference order. Arena runs one judge from a vendor other than the parent's, and when the parent runs on any Claude model it runs the pool's first two Claude entries as two judges. An `inherit-parent` or `auto` entry never judges. Fable, Opus, Sonnet, and Haiku are one vendor. `swarm workers` is the default model for every swarm worker.

### 4. Validate

Every real entry must be in the detected set, at an effort its model lists and at `xhigh` or below, or at `default` when its model has no effort option. A trailing `fast` is valid only on a model that lists `fastMode` or `serviceTier`. If one is not, stop and ask again.

### 5. Write the file

Create `~/.pstack/` if needed and overwrite `~/.pstack/t3-models.md` whole, so running this again stays idempotent. Shape:

```
# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# Value: <claude family> <effort> (opus high), or <providerInstanceId>/<model> <effort> from orchestrator_capabilities. `inherit-parent` or `auto`: run on the parent thread's model.
# Panel lists run one child per entry, alias entries included.
# defaults: 3
# budget: large
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

Never put these lines in `AGENTS.md` or `CLAUDE.md`.

### 6. Confirm

Tell the user the file was written. It applies the next time a skill runs, with no restart. Running this skill again updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, follow the **create-verification-skill** skill. On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /create-formal-verification-skill." On yes, follow the **create-formal-verification-skill** skill. On no, move on without pushing.
