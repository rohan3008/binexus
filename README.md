# binexus

[![test](https://github.com/rohan3008/binexus/actions/workflows/test.yml/badge.svg)](https://github.com/rohan3008/binexus/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/binexus)](https://www.npmjs.com/package/binexus)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Project page: https://rohan3008.github.io/binexus/

**Find the dead vibe-coded projects on your machine and the background jobs
they left running. You decide what to pause, strip, or delete.**

binexus never deletes anything on its own. It scans, your coding agent asks
you project by project, and every action is confirmed again before it runs.
"Delete" means a move to a trash folder you can restore from. Nothing is
ever unlinked.

```
40 projects: 21 active, 14 idle, 5 stale
19164 MB of regenerable artifacts (node_modules, .venv, build, ...)

Background jobs still running for idle/stale projects:
  idle  edgefinder   <- launchd:com.edgefinder.daily
  idle  moonscanner  <- launchd:com.moonscanner.backend
```

That is a real scan of the author's laptop. Two daemons had been waking up
every day for projects untouched since the summer.

## Install the skill (recommended)

binexus is an [Agent Skill](https://agentskills.io). Your coding agent is
the brain, the `binexus` CLI is the hands.

**1. Add the skill to your agent.** This works for Claude Code, Cursor,
Codex CLI, Gemini CLI, GitHub Copilot and any other agent that reads
`SKILL.md` files:

```
npx skills add rohan3008/binexus
```

No `npx skills`? Copy the skill by hand. For Claude Code:

```
mkdir -p ~/.claude/skills/binexus
curl -fsSL https://raw.githubusercontent.com/rohan3008/binexus/main/SKILL.md -o ~/.claude/skills/binexus/SKILL.md
```

For other agents, put `SKILL.md` wherever that agent loads skills from
(`.agents/skills/binexus/SKILL.md` is read by most of them).

**2. Ask your agent to run it:**

> run binexus on ~/Documents

The agent runs the scan, shows you a summary, then goes through projects
one at a time, worst offenders first. For each one you choose:

| You say | What happens |
|---|---|
| keep | nothing |
| pause | its background jobs stop; files untouched |
| strip | regenerable artifacts are deleted; source and git stay |
| delete | the whole folder moves to `~/.binexus/trash` |

**3. Run the plan it wrote:**

```
npx --yes github:rohan3008/binexus apply ~/Documents/binexus-plan.json
```

You get a `[y/N]` for every action. Default is no.

## Use it without an agent

```
npx --yes github:rohan3008/binexus scan ~/Documents    # read-only, writes report.json
npx --yes github:rohan3008/binexus apply plan.json     # confirms each action, then acts
npx --yes github:rohan3008/binexus restore             # list the trash
npx --yes github:rohan3008/binexus restore 2026-10-22-name
```

The `github:` form runs the latest main straight from this repo. Once the
package is on npm, plain `npx binexus` works too.

`plan.json` looks like this:

```json
{
  "version": 1,
  "reportPath": "/Users/you/Documents/report.json",
  "actions": [
    {"path": "/Users/you/Documents/old-thing", "action": "pause"},
    {"path": "/Users/you/Documents/bigger-thing", "action": "strip"},
    {"path": "/Users/you/Documents/dead-thing", "action": "delete"}
  ]
}
```

Requires Node 20 or newer. No other dependencies.

## What it looks for

A project is any folder with `.git`, `package.json`, `pyproject.toml`,
`Package.swift`, or an `.xcodeproj`. For each one:

| Signal | Meaning |
|---|---|
| last commit, newest source file | last activity. Build artifacts, `.git` internals and gitignored output (logs, databases) do not count, so a daemon writing logs cannot make a dead project look alive. |
| class | `active` under 30 days, `idle` up to 120 days, `stale` beyond |
| protected | unpushed commits, uncommitted changes, no upstream, or not git. Deleting could lose work that exists nowhere else. |
| artifacts | `node_modules`, `.venv`, `venv`, `build`, `dist`, `.build`, `DerivedData`, `.next`, `.turbo`, `.cache`, `__pycache__`, `.pytest_cache`, Rust `target` |
| jobs | launchd agents in `~/Library/LaunchAgents`, crontab lines, pm2 processes whose paths point inside the project |

The jobs are the part nothing else catches. Disk cleaners count bytes. They
do not know a project is dead, and they never look at launchd.

## The three actions and how to undo them

| Action | Does | Undo |
|---|---|---|
| pause | Unloads the launchd agent and moves its plist to `~/.binexus/paused`. Comments out the cron line. `pm2 stop`. | Move the plist back and `launchctl bootstrap gui/$(id -u) <plist>`. Uncomment the line. `pm2 start`. |
| strip | Deletes the artifact dirs listed in the report. Source and `.git` untouched. | Reinstall. |
| delete | Pauses attached jobs, then moves the folder to `~/.binexus/trash/<date>-<name>` with a manifest. | `npx binexus restore <name>` |

## Safety rules

- Nothing is unlinked. You empty `~/.binexus/trash` yourself when you are sure.
- Every action is confirmed at apply time, default no. `--yes-to-strip`
  skips the prompt for strip only.
- A protected project cannot be deleted unless the plan carries
  `acknowledgeProtected: true`, and then you must type the project's name.
- Protection is rechecked at apply time, not just at scan time.
- The agent only reads. The CLI is the only thing that changes anything,
  and it only does what the plan says.
- Set `BINEXUS_HOME` to put the trash on the same volume as your projects
  if a move fails with `EXDEV`.

## Not in v1

Cloud resources (Fly, Vercel, DigitalOcean), Docker containers, Windows.
Open an issue if one of those is the thing costing you money.

## Development

```
git clone https://github.com/rohan3008/binexus
cd binexus
npm test
```

Tests build their own fixtures in a temp directory and never touch your real
launchd agents or crontab.

## License

MIT
