---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Open a todo list with one entry per phase (Frame, Fan out, Cross-judge, Pick, Graft, Verify) before launching anything. Use your todo tool (`TodoWrite` in Claude, `update_plan` in Codex). Without one, keep the list in your reply.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric, 3-6 concrete gradeable criteria for what success looks like on *this* task. It is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners from the `arena runners` line in `~/.pstack/t3-models.md`, by default `opus high` and `fable medium`. Call `orchestrator_capabilities` once before the first `delegate_task`, and resolve each value to a `target` per the Subagents section of the **poteto-mode** skill. An `auto` or `inherit-parent` entry is the parent model, so omit `target`. If `delegate_task` rejects a target, never pass it again. Use the closest model of the same family that `orchestrator_capabilities` lists or drop the seat, keep at least two runners, and say so. A Claude value's family is its name (`opus`, `sonnet`, `haiku`, `fable`). A `<providerInstanceId>/<model>` value's family is the model's text before the first hyphen. Spawn more for multiple design directions, and repeat one model when the work is generation-bound, not judgment-sensitive. Pick each subagent's reasoning level per the Subagents section of the **poteto-mode** skill.
4. Give each candidate its own output location (a git worktree where possible, through `isolation: "worktree"` on `delegate_task`, otherwise `/tmp/arena-<slug>/candidate-<n>/`), per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Start all N candidates with `delegate_task` in one message, each with its runner's `target`, the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected.

Each child wakes your thread when it finishes. Do not poll.

If a candidate produces no output, proceed with N-1 and note the dropout.

## Phase C: Cross-judge

After all Phase B candidates complete, start one judge with `delegate_task` and `role: "review"` from the `arena cross-judge pool` line in `~/.pstack/t3-models.md`, by default `opus xhigh`, `fable medium`. Its brief says "do not edit files". The judge is never from the parent's vendor, and Fable counts as Claude for that check, so use the first entry from another vendor. When the parent runs on a Claude Opus model, run one judge for each of the first two Claude entries in the pool (default `opus xhigh` and `fable medium`) instead, in parallel with the same brief. Read both, name any disagreement, and decide. An `auto` or `inherit-parent` entry is the parent model. If you do not know the parent's model, use the first entry that is not `auto` or `inherit-parent` and say that the vendor check did not run. If no entry is from another vendor, skip the judge and say so. If `delegate_task` rejects a target, use the closest model of the same family that `orchestrator_capabilities` lists, then the next such entry, or skip the judge, and say so. While you read in Phase D, each judge scores each candidate, by path label, on each rubric criterion and recommends a base.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge, or both judges, when Phase C ran one. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API, per the Laziness Protocol.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, per the **redesign-from-first-principles** principle skill, so the result stays coherent under one mental model. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output, per the **prove-it-works** principle skill. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, each cross-judge's verdict or that Phase C skipped the judge, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.
