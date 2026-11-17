---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

## Start

Open a todo list with one entry per phase before launching anything. Use your todo tool (`TodoWrite` in Claude, `update_plan` in Codex). Without one, keep the list in your reply.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Pick the worker model from the `swarm workers` line in `~/.pstack/t3-models.md`. If the file or that line is missing, use `opus high`. Call `orchestrator_capabilities` once before the first `delegate_task`, and resolve the value to a `target` per the Subagents section of the **poteto-mode** skill. For `auto` or `inherit-parent`, omit `target` so the workers run on the parent model. If `delegate_task` rejects a target, never pass it again. Use the default and say so. If it rejects the default, use the closest model of the same family that `orchestrator_capabilities` lists, then omit `target`, and say so. For a model race, name each arm's model up front. Pick each subagent's reasoning level for the job, per the Subagents section of the **poteto-mode** skill.
4. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Start all N workers with `delegate_task` in one message, with `isolation: "worktree"` and the step 3 `target`, left unset for `auto` or `inherit-parent`. A worktree is a separate checkout from the parent's commit, and uncommitted edits stay behind. If `isolation: "worktree"` is rejected, for example because the thread's folder is not a git repo, create a git worktree per worker yourself and name its path in the brief. Leave `isolation` at its default only when the worker needs access to something in the parent's checkout. Each worker wakes your thread when it finishes. Do not poll.

When a worker must start from a non-default pushed branch, its brief tells it to check out that branch first.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

## Phase D: Report

Return one consolidated in-chat report with a result table, issue one-liners, gaps or dropouts, and the race rule when used.
