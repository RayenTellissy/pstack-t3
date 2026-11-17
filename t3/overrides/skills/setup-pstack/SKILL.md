---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget, across every provider T3 Code runs. Detects available provider instances and models and writes a model config file that overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `~/.pstack/t3-models.md`, the file that sets pstack's model per role in T3 Code. Every pstack skill that picks a model reads it, and falls back to the skill default for a missing role.

Read [the T3 Code adapter](../../docs/harness/t3-code.md) first. Its Models section defines the value format (`opus high`, or `<providerInstanceId>/<model> <effort>` for any provider), the default roles, and where each role applies.

## Steps

### 1. Detect available models

Call `orchestrator_capabilities`. The detected set is every `(providerInstanceId, model id)` pair whose provider has `canRunChildTask: true`, each with the efforts its effort-like option lists (`effort` or `reasoningEffort`). A model with no effort option is written with effort `default`. Use `search` to find a model the short list omits when the user names one. Never write a model you have not confirmed is in the detected set. `inherit-parent` and `auto` are always valid.

Tell the user which provider instances cannot run child tasks and why, from their `constraints`, in one line each. Enabling one in **Settings > Providers** and re-running this skill makes it available.

### 2. Load current state

The default mapping is the file shape in step 5, the same as the adapter's Default roles. If `~/.pstack/t3-models.md` exists, read it and treat its `# budget` line and role values as the current choices. Otherwise start from the defaults. Drop a line whose role is not in step 5 and tell the user.

A family value such as `opus high` is detected when a `claudeAgent` instance that can run a child task lists a `claude-<family>-*` model with that effort. Mark any value that is not detected as needing a choice. With no Claude instance able to run child tasks, every default needs a choice: offer the detected models.

The default panels (`arena runners`, `arena cross-judge pool`, `architect runners`, `interrogate reviewers`) are Claude-only. When another vendor can run child tasks, mention once that adding it as a panel entry gives cross-vendor review, and leave the panels as they are unless the user asks.

### 3. Budget, map, and confirm

**(a) Ask for a budget** with your provider's question tool, else plain text. Offer these labels, and name the current budget when the file records one. With no file, say that `large` matches the skill defaults.

- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Each role's target effort is its default effort moved down by the budget: `large` keeps it, `medium` lowers one step, `small` lowers two, on the ladder `xhigh` > `high` > `medium` > `low`. No role runs above `xhigh`, and the bottom stays at `low`. Set every real entry's effort to its role's target, panel entries included. If the model does not list that effort, use its highest listed effort at or below the target. `inherit-parent`, `auto`, and `default` efforts do not change. Keep any role the user changed on a previous run.

**(c) Show the roles and confirm.** Show every role and its value, mark each one needing a choice, and list dropped lines. Ask whether to accept or change specific roles, offering detected models at `xhigh` or below plus `inherit-parent` and `auto` (both mean the role runs on the parent thread's model). Panel roles (`arena runners`, `architect runners`, `interrogate reviewers`) are lists, and one child runs per entry, so the length sets the count. `arena cross-judge pool` is a list in preference order; Arena runs one judge from a vendor other than the parent's, and an `inherit-parent` or `auto` entry never judges. Fable, Opus, Sonnet, and Haiku are one vendor, so with a Claude parent the default pool has no cross-vendor judge and Arena says so. `swarm workers` is the default model for every swarm worker. The `hardest tasks`, `how`, `why`, `reflect`, and `architect` roles are retired upstream: no skill reads them, so say they have no effect when you show them.

### 4. Validate

Every real entry must be in the detected set, at an effort its model lists, at `xhigh` or below. If one is not, stop and ask again.

### 5. Write the file

Create `~/.pstack/` if needed and overwrite `~/.pstack/t3-models.md` whole, so re-runs stay idempotent. Shape:

```
# pstack model configuration for T3 Code. One line per role. Delete a line to fall back to the skill default.
# Value: <claude family> <effort> (opus high), or <providerInstanceId>/<model> <effort> from orchestrator_capabilities. `inherit-parent` or `auto`: run on the parent thread's model.
# Panel lists run one child per entry, alias entries included.
# defaults: t3-1
# budget: large (xhigh)
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

Never put these lines in `AGENTS.md` or `CLAUDE.md`.

### 6. Confirm

Tell the user the file was written. It applies on the next skill run; no restart is needed. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with $create-verification-skill." On yes, follow the **create-verification-skill** skill. On no, move on.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill. If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with $create-formal-verification-skill." On yes, follow the **create-formal-verification-skill** skill. On no, move on.
