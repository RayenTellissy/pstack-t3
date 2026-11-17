---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget, across every provider T3 Code runs. Detects available provider instances and models and writes a model config file that overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `~/.pstack/t3-models.md`, the file that sets pstack's model per role in T3 Code. Every pstack skill that picks a model reads it, and falls back to the skill default for a missing role.

Read [the T3 Code adapter](../../docs/harness/t3-code.md) first. Its Models table defines the value format, `<providerInstanceId>/<model> <effort>`, and how Cursor default slugs map to T3 Code.

## Steps

### 1. Detect available models

Call `orchestrator_capabilities`. The detected set is every `(providerInstanceId, model id)` pair whose provider has `canRunChildTask: true`, each with the efforts its effort-like option lists (`effort` or `reasoningEffort`). A model with no effort option is written with effort `default`. Use `search` to find a model the short list omits when the user names one. Never write a model you have not confirmed is in the detected set. `inherit-parent` and `auto` are always valid.

Tell the user which provider instances cannot run child tasks and why, from their `constraints`, in one line each. Enabling one in **Settings > Providers** and re-running this skill makes it available.

### 2. Load current state

The default mapping is the file shape in step 5. If `~/.pstack/t3-models.md` exists, read it and treat its `# budget` line and role values as the current choices. Otherwise start from the defaults. Drop a line whose role is not in step 5 and tell the user.

Resolve each default against the detected set before showing it:

- A default whose model is detected keeps it.
- A `claudeAgent/...` default whose instance id differs (for example `claudeAgent_2`) takes the detected instance that runs that model.
- The third panel seat (`codex/gpt-6.1-sol`) exists for vendor diversity. When no Codex instance can run a child task, give it to the strongest detected model from a vendor the panel does not already have (Antigravity Gemini, Grok, then any other). With only Claude available, use `claudeAgent/claude-sonnet-5-5` and say the panel has one vendor.
- Any other undetected default is marked as needing a choice.

### 3. Budget, map, and confirm

**(a) Ask for a budget** with your provider's question tool, else plain text. Offer these labels, and name the current budget when the file records one. With no file, say that `large` matches the skill defaults.

- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Each role's target effort is its default effort moved down by the budget: `large` keeps it, `medium` lowers one step, `small` lowers two, on the ladder `xhigh` > `high` > `medium` > `low`. No role runs above `xhigh`, and the bottom stays at `low`. Set every real entry's effort to its role's target, panel entries included. If the model does not list that effort, use its highest listed effort at or below the target. `inherit-parent`, `auto`, and `default` efforts do not change. Keep any role the user changed on a previous run.

**(c) Show the roles and confirm.** Show every role and its value, mark each one needing a choice, and list dropped lines. Ask whether to accept or change specific roles, offering detected models at `xhigh` or below plus `inherit-parent` and `auto` (both mean the role runs on the parent thread's model). Panel roles (`arena runners`, `interrogate reviewers`) are lists, and one child runs per entry, so the length sets the count. `arena cross-judge pool` is a list in preference order; Arena runs one judge from a vendor other than the parent's, and an `inherit-parent` or `auto` entry never judges. Fable, Opus, Sonnet, and Haiku are one vendor. `swarm workers` is the default model for every swarm worker.

### 4. Validate

Every real entry must be in the detected set, at an effort its model lists, at `xhigh` or below. If one is not, stop and ask again.

### 5. Write the file

Create `~/.pstack/` if needed and overwrite `~/.pstack/t3-models.md` whole, so re-runs stay idempotent. Shape:

```
# pstack model configuration for T3 Code. One line per role. Delete a line to fall back to the skill default.
# Value: <providerInstanceId>/<model> <effort>, from orchestrator_capabilities. `inherit-parent` or `auto`: run on the parent thread's model.
# Panel lists run one child per entry, alias entries included.
# defaults: t3-1
# budget: large (xhigh)
feature, refactoring: claudeAgent/claude-opus-5-5 xhigh
bug-fix: claudeAgent/claude-opus-5-5 xhigh
perf-issue: claudeAgent/claude-opus-5-5 xhigh
hillclimb: claudeAgent/claude-opus-5-5 xhigh
judgment and prose: claudeAgent/claude-opus-5-5 xhigh
arena runners: claudeAgent/claude-fable-5-2 high, claudeAgent/claude-opus-5-5 high, codex/gpt-6.1-sol high
arena cross-judge pool: codex/gpt-6.1-sol high, claudeAgent/claude-opus-5-5 high
swarm workers: claudeAgent/claude-opus-5-5 high
interrogate reviewers: claudeAgent/claude-fable-5-2 high, claudeAgent/claude-opus-5-5 high, codex/gpt-6.1-sol high
```

Never put these lines in `AGENTS.md` or `CLAUDE.md`.

### 6. Confirm

Tell the user the file was written. It applies on the next skill run; no restart is needed. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with $create-verification-skill." On yes, follow the **create-verification-skill** skill. On no, move on.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill. If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with $create-formal-verification-skill." On yes, follow the **create-formal-verification-skill** skill. On no, move on.
