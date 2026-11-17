# Set up pstack

In this page you install pstack, pick which models pstack uses, and run your first task. Setup is one install command plus a short conversation.

## Install pstack

Clone the repo and run the installer:

```bash
git clone https://github.com/RayenTellissy/pstack-t3
cd pstack-t3
node scripts/install.mjs
```

The installer links every pstack skill into `~/.agents/skills/`, which Codex, Cursor, OpenCode, and Pi read, into `~/.claude/skills/` for Claude, and into `~/.gemini/config/skills/` when `~/.gemini` exists. Keep the clone where it is, because the links point into it.

Then open T3 Code's command palette and run **Restart agent session**, so the agent picks up the new skills. Each command in this guide works as written, with no prefix.

## Pick your models

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.pstack/t3-models.md`, a small file every pstack skill reads.

The defaults are the same as the `large` budget. Prose and judgment run on Opus at `xhigh` reasoning. Code delegates and swarm workers run on Opus at `high`. Each review panel pairs an Opus seat with a Fable seat at `medium`. No role runs above `xhigh`. Outside a review panel, Fable runs only when you name it for a task or after two Opus runs of the same brief fail their check. `medium` lowers each role one level and `small` lowers it two, and both spend fewer tokens.

A role's value is a model family and an effort, such as `opus high`, or a provider instance, model, and effort for any provider T3 Code runs, such as `codex/<model> high`. Add `fast` after the effort to turn on fast mode.

You only override what you care about. A role with no line in the file keeps the skill's default. To restore a default, delete that role's line. A rerun of `/setup-pstack` keeps any role whose model differs from the default. When a default changes, a file written before the change still pins the old default. To drop a pin, delete that role's line or the file.

You might be wondering how to keep a role on whatever model your thread runs. Set a role to `inherit-parent` or `auto` and pstack runs that subagent on your parent thread's model. Both values mean the same thing, and neither is a model name. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/swarm` worker unless a race names a model for each arm.

## Accept the verification offers, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.agents/skills/verify-<app>/`, linked into `.claude/skills/` for Claude, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

The model file applies the next time a skill runs, with no restart.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/setup-pstack` and pick a smaller reasoning budget or cheaper models. A strong model in the main thread with cheaper, faster models in the code roles is a good split.
- Set a role to `auto` or `inherit-parent` so it runs on the thread's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt.

From here you can type normal follow-ups. To keep `/poteto-mode` on for the whole thread, say in your first message to use it for every task in the thread, or add `/poteto-mode` to each message. A skill attached to one message fades as the thread moves on.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
