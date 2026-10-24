# binexus

[![test](https://github.com/rohan3008/binexus/actions/workflows/test.yml/badge.svg)](https://github.com/rohan3008/binexus/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/binexus)](https://www.npmjs.com/package/binexus)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-blueviolet)](#install-as-a-claude-code-plugin-recommended)

**A Claude Code plugin that finds the dead vibe-coded projects on your
machine and the background jobs they left running. Your agent asks you,
project by project, what to pause, strip, or delete. You decide every
action. Nothing is ever unlinked.**

Project page: https://rohan3008.github.io/binexus/

```
42 projects: 22 active, 15 idle, 5 stale
20570 MB of regenerable artifacts (node_modules, .venv, build, ...)

Background jobs still running for idle/stale projects:
  idle  edgefinder   <- launchd:com.edgefinder.daily
  idle  moonscanner  <- launchd:com.moonscanner.backend
```

That is a real scan of the author's laptop. Two daemons had been waking up
every day for projects untouched since the summer. Nothing else on the
machine knew.

---

## Contents

- [Why this exists](#why-this-exists)
- [How it looks](#how-it-looks)
- [Install as a Claude Code plugin (recommended)](#install-as-a-claude-code-plugin-recommended)
- [Install as a plain skill (Cursor, Codex, Gemini CLI, Copilot)](#install-as-a-plain-skill-cursor-codex-gemini-cli-copilot)
- [Use the CLI on its own](#use-the-cli-on-its-own)
- [What a session looks like, step by step](#what-a-session-looks-like-step-by-step)
- [What it looks for](#what-it-looks-for)
- [The three actions and how to undo each one](#the-three-actions-and-how-to-undo-each-one)
- [Safety model](#safety-model)
- [File formats](#file-formats)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [How it works inside](#how-it-works-inside)
- [Development and contributing](#development-and-contributing)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why this exists

If you build a lot of small projects with an AI coding agent, your projects
folder fills up fast. Most of those folders are harmless. Three kinds are
not:

1. **Folders full of regenerable junk.** `node_modules`, `.venv`, `build`,
   `dist`, `DerivedData`. They are most of the bytes, and every one of them
   can be rebuilt with one install command.
2. **Projects that are still running.** A launchd agent, a cron line, or a
   pm2 process you set up in week one keeps firing every day, long after
   you stopped opening the folder. It burns CPU, battery, API quota, and
   sometimes money, and nothing tells you.
3. **Projects that are dead but not backed up.** Unpushed commits, dirty
   working trees, repos with no remote. These are the ones you must not
   delete by accident.

Disk cleaners count bytes. They cannot tell a dead project from a live one,
and they never look at launchd. binexus does both, and then it does the one
thing a cleaner can't: it asks you.

## How it looks

**1. Scan.** Read-only. The summary leads with the jobs, because those are
the quiet cost.

![binexus scan](docs/screenshots/1-scan.png)

**2. Your agent asks you, one project at a time.** Worst offenders first,
with the signals and a recommendation. You answer keep, pause, strip, or
delete. Protected projects say why.

![agent conversation](docs/screenshots/2-agent.png)

**3. It writes a plan and hands you the command.** Nothing has changed on
disk yet.

![plan written](docs/screenshots/3-plan.png)

**4. Apply confirms every action again.** Default no. A protected project is
refused outright unless you acknowledged it in the plan. Restore brings a
deleted project back. (Demo folder; the launchd job in it is a fixture.)

![apply and restore](docs/screenshots/4-apply.png)

## Install as a Claude Code plugin (recommended)

From a terminal:

```
claude plugin marketplace add rohan3008/binexus
claude plugin install binexus@binexus
```

Or inside a Claude Code session:

```
/plugin marketplace add rohan3008/binexus
/plugin install binexus@binexus
```

Then, in any session:

```
/binexus:binexus ~/Documents
```

or just say **"run binexus on ~/Documents"**. The skill also triggers on
its own when you ask things like "what's taking up space", "what's still
running in the background", or "clean up my old projects".

The plugin bundles the CLI, so a scan downloads nothing and runs offline.
Updates: `claude plugin update binexus@binexus`. Third-party marketplaces
do not auto-update by default.

Requirements: Claude Code, Node 20 or newer, macOS or Linux.

## Install as a plain skill (Cursor, Codex, Gemini CLI, Copilot)

binexus is also a standard [Agent Skill](https://agentskills.io), so any
agent that reads `SKILL.md` files can use it. Your agent is the brain, the
`binexus` CLI is the hands.

**1. Add the skill:**

```
npx skills add rohan3008/binexus
```

This detects which agents you have installed and puts the skill where each
one looks. No `npx skills`? Copy `skills/binexus/SKILL.md` from this repo
into your agent's skills folder by hand. `.agents/skills/binexus/SKILL.md`
is read by most agents; Claude Code also reads
`~/.claude/skills/binexus/SKILL.md`.

**2. Ask your agent:**

> run binexus on ~/Documents

Installed this way, the skill runs the CLI straight from GitHub with
`npx --yes github:rohan3008/binexus`, so the first run downloads a 30 KB
package.

## Use the CLI on its own

No agent needed. The CLI is read-only until you hand it a plan.

```
npx --yes github:rohan3008/binexus scan ~/Documents       # writes report.json
npx --yes github:rohan3008/binexus apply plan.json        # confirms each action, then acts
npx --yes github:rohan3008/binexus restore                # list the trash
npx --yes github:rohan3008/binexus restore 2026-10-22-name
```

Once the package is on npm, plain `npx binexus` works the same way. If you
installed the plugin, the bundled copy is at
`~/.claude/plugins/marketplaces/binexus/cli/binexus.js`.

You write `plan.json` yourself in this case. See [File formats](#file-formats).

## What a session looks like, step by step

This is what the skill tells your agent to do. Knowing the shape helps you
steer it.

**Step 1, scan.** The agent asks which folder to scan if you did not say,
then runs the scanner and writes `binexus-report.json` into that folder.
Nothing is modified.

**Step 2, the summary screen.** One screen: counts by class, total
regenerable size, and every background job attached to an idle or stale
project. Jobs come first on purpose. They are the thing you forgot.

**Step 3, one project at a time.** Order is by payoff: stale projects with
jobs, then idle projects with jobs, then stale by artifact size, then idle
by artifact size. Active projects are skipped unless you ask. For each
project the agent shows the last activity date, size, artifacts, jobs,
whether it is protected and why, and a recommendation. You answer with one
word:

| You say | What goes in the plan |
|---|---|
| keep | nothing |
| pause | stop its background jobs, touch no files |
| strip | delete regenerable artifacts only; source and git stay |
| delete | move the whole folder to the trash; jobs are paused first |

Not sure? Say "look inside" and the agent reads the README, the git log, and
recent files before recommending again. It may read. It may not edit,
install, or run anything in the project.

**Step 4, the plan.** The agent writes `binexus-plan.json` next to the
report and gives you the apply command. The agent never runs apply. That is
your move.

**Step 5, apply.** The CLI shows every action and asks `[y/N]`. Default is
no. Then it does exactly what you said yes to, and prints a one-line tally.

## What it looks for

A **project** is any folder that directly contains `.git`, `package.json`,
`pyproject.toml`, `Package.swift`, or an `.xcodeproj`. The scanner does not
look for projects nested inside a project, and it skips `node_modules` and
hidden folders while walking.

For each project it records:

| Signal | How it is measured | Why it matters |
|---|---|---|
| last activity | the newer of the last commit date and the newest file that git does not ignore | gitignored output such as logs and databases does not count, so a daemon writing logs every night cannot make a dead project look alive |
| class | `active` if touched in the last 30 days, `idle` up to 120 days, `stale` beyond | the agent uses this to order the conversation, not as a verdict |
| protected | true if there are unpushed commits, uncommitted changes, no upstream remote, or the folder is not a git repo at all | deleting a protected project could lose work that exists nowhere else |
| artifacts | directories named `node_modules`, `.venv`, `venv`, `build`, `dist`, `.build`, `DerivedData`, `.next`, `.turbo`, `.cache`, `__pycache__`, `.pytest_cache`, and Rust `target` next to a `Cargo.toml`, with their sizes | everything in this list can be rebuilt from source with one command |
| jobs | launchd agents in `~/Library/LaunchAgents`, lines in your crontab, and pm2 processes, matched by whether any path in the job points inside the project | this is what nothing else catches |

Jobs whose paths point outside the scanned folder are listed under
`unmatchedJobs` in the report so the agent can mention them, but no action
is ever proposed for them.

## The three actions and how to undo each one

| Action | What it does | Undo |
|---|---|---|
| **pause** | launchd: unloads the agent with `launchctl bootout` and moves its plist to `~/.binexus/paused/`. cron: comments the line out with a `# binexus paused <date>:` marker. pm2: `pm2 stop <name>`. No files in the project are touched. | Move the plist back to `~/Library/LaunchAgents` and run `launchctl bootstrap gui/$(id -u) <plist>`. Uncomment the cron line. `pm2 start <name>`. |
| **strip** | Deletes the artifact directories listed in the report for that project. Source, `.git`, and everything else stay. | Run the project's install command again. |
| **delete** | Pauses any attached jobs, then moves the whole folder to `~/.binexus/trash/<date>-<name>/` and writes a manifest beside it recording where it came from. | `binexus restore <name>`. Restoring does not re-enable paused jobs; the command prints how. |

Strip is the boring win and is safe to say yes to freely. Pause is the
interesting one. Delete is reversible until you empty the trash yourself.

## Safety model

The whole design is built so that the AI never touches your disk and the
thing that does is small, deterministic, and tested.

- **The agent only reads.** The skill forbids the agent from editing,
  installing, running, or deleting anything. Its only output is a plan file.
- **The CLI only does what the plan says.** It validates the plan against
  the report it was built from and refuses anything unknown.
- **Every action is confirmed at apply time**, with the default set to no.
  End of input also means no, so a script that forgets to answer does
  nothing.
- **Nothing is unlinked, ever.** Delete is a move into `~/.binexus/trash`.
  You empty that folder by hand when you are sure. There is no `--force`.
- **Protected projects need two extra steps.** The plan must carry
  `acknowledgeProtected: true` on that action, which the skill tells the
  agent never to set on its own initiative, and then the CLI makes you type
  the project's name.
- **Protection is rechecked at apply time.** If you committed something
  between scan and apply, the delete is refused.
- **Strip cannot escape the project.** Every artifact path is resolved and
  must sit inside the project folder, or the whole strip is refused.
- **Tests never touch your real machine.** They build fixtures in a temp
  directory, including fake git remotes and fake launchd plists.

## File formats

Both files carry `"version": 1` so the skill and the CLI can evolve
independently.

**`report.json`**, written by `scan`:

```json
{
  "version": 1,
  "root": "/Users/you/Documents",
  "scannedAt": "2026-10-22T10:00:00.000Z",
  "projects": [
    {
      "path": "/Users/you/Documents/edgefinder",
      "name": "edgefinder",
      "class": "idle",
      "protected": false,
      "lastCommit": "2026-06-26T09:12:00+01:00",
      "newestSourceMtime": "2026-06-26T09:12:00.000Z",
      "unpushedCommits": 0,
      "uncommittedChanges": false,
      "isGit": true,
      "hasUpstream": true,
      "totalBytes": 87031808,
      "artifactBytes": 83886080,
      "artifacts": [{ "path": ".venv", "bytes": 83886080 }],
      "jobs": [
        {
          "kind": "launchd",
          "id": "com.edgefinder.daily",
          "plist": "/Users/you/Library/LaunchAgents/com.edgefinder.daily.plist",
          "paths": ["/Users/you/Documents/edgefinder/run.sh"]
        }
      ]
    }
  ],
  "unmatchedJobs": []
}
```

**`plan.json`**, written by the agent or by you:

```json
{
  "version": 1,
  "reportPath": "/Users/you/Documents/binexus-report.json",
  "actions": [
    { "path": "/Users/you/Documents/moonscanner", "action": "pause" },
    { "path": "/Users/you/Documents/edgefinder",  "action": "delete" },
    { "path": "/Users/you/Documents/polya",       "action": "strip" },
    { "path": "/Users/you/Documents/old-thing",   "action": "delete", "acknowledgeProtected": true }
  ]
}
```

Rules: `action` is `pause`, `strip`, or `delete`. `keep` is not an action,
just leave the project out. Every `path` must appear in the report named by
`reportPath`. If `reportPath` is missing, `report.json` next to the plan is
used.

## Configuration

| Setting | Default | Meaning |
|---|---|---|
| scan root | current directory | the folder to look for projects in; pass it as the first argument |
| `--out <file>` | `./report.json` | where `scan` writes the report |
| `--yes-to-strip` | off | `apply` skips the prompt for strip actions only; pause and delete always prompt |
| `BINEXUS_HOME` | `~/.binexus` | where `trash/` and `paused/` live. Set it to a folder on the same volume as your projects if moves fail with `EXDEV` |

The 30 and 120 day thresholds are constants in `src/scan/classify.js`. They
shape the conversation order, not what is allowed, so there is no flag for
them yet. Open an issue if you need one.

## Troubleshooting

**"EXDEV: cross-device link not permitted" on delete.** The trash folder
and the project are on different volumes, and a move across volumes is not
atomic. Set `BINEXUS_HOME` to a folder on the same volume as your projects
and run apply again.

**A delete was refused for a project I know is pushed.** The repo has no
upstream set for the current branch, which counts as protected. Run
`git push -u origin <branch>` once, rescan, and it will be clear.

**A project I abandoned shows as active.** Something in it is being written
to and is not gitignored. Check with `git status`. Adding the output
directory to `.gitignore` fixes both the scan and your repo hygiene.

**launchctl says the service is not loaded.** That is fine. Pause still
moves the plist out of `~/Library/LaunchAgents`, which is what stops it
coming back at next login.

**The agent ran apply itself.** It should not. The skill says so in two
places. If it happens, open an issue with the transcript so the wording can
be tightened.

**Scan is slow on a huge folder.** It walks every file to sum sizes. A
20 GB projects folder takes about 30 seconds. Scan a narrower root if that
is too long.

## FAQ

**Does it delete anything on its own?** No. The scanner is read-only. The
agent only writes a plan. The CLI asks before every action and moves
instead of deleting.

**Can I lose work?** Only by deleting a protected project after
acknowledging it in the plan and typing its name, and even then it sits in
`~/.binexus/trash` until you empty it.

**Does it need an API key?** No. The agent you already use is the brain.
There is no built-in model call.

**Does it work without an AI agent?** Yes. Run `scan`, write the plan by
hand, run `apply`.

**What about cloud resources?** Not in v1. Fly machines, Vercel deploys,
DigitalOcean droplets, and Convex projects are the obvious next thing. See
[Roadmap](#roadmap).

**What about Docker containers?** Not in v1.

**Windows?** Not supported. The job discovery is launchd, cron, and pm2.
The scanner and strip probably run, but it is untested there.

**Why not just use npkill or a disk cleaner?** They count bytes. They do
not know a project is dead, they never look at background jobs, and they
will happily delete `node_modules` from the project you are working on
today.

**How much does the plugin add to every session?** About 100 tokens for the
skill description. The full skill text loads only when it triggers.

## How it works inside

Four parts, each with one job, each testable alone.

```
cli/binexus.js          argument parsing and output only
src/scan/walk.js        find project folders
src/scan/git.js         last commit, unpushed, dirty, upstream, newest non-ignored mtime
src/scan/artifacts.js   one walk per project: sizes and artifact dirs
src/scan/jobs.js        parse launchd plists, crontab, pm2; match to projects
src/scan/classify.js    active / idle / stale, protected
src/scan/index.js       assemble report.json
src/apply/validate.js   check a plan against its report
src/apply/pause.js      launchctl, crontab, pm2
src/apply/strip.js      remove artifact dirs, refusing paths outside the project
src/apply/trash.js      move to trash with manifest, list, restore
src/apply/index.js      the confirm-then-act loop
src/prompt.js           y/N and typed-name prompts
skills/binexus/SKILL.md the conversation the agent runs
```

Every side effect is injected: shell commands, prompts, the clock, the home
directory. That is what lets the tests exercise pause and delete for real
without touching a real launchd agent.

Zero runtime dependencies. Plain ES-module JavaScript on Node 20+. Tests use
the built-in `node:test` runner.

## Development and contributing

```
git clone https://github.com/rohan3008/binexus
cd binexus
npm test                          # 32 tests, fixtures in a temp dir
claude plugin validate --strict . # check the plugin and marketplace manifests
claude --plugin-dir .             # try the plugin in a session without installing it
```

Good first contributions:

- a new job source (systemd user units would make Linux first-class)
- a new artifact directory name, with a test in `test/artifacts.test.js`
- a new project marker, with a test in `test/walk.test.js`
- better wording in `SKILL.md` if your agent did something odd; the
  conversation is a prompt, so it is editable by anyone

Pull requests need a test. CI runs on macOS and Ubuntu, Node 20 and 22.

## Roadmap

- **v0.3**: cloud resources. Fly, Vercel, DigitalOcean, Convex, read through
  their CLIs if present, with the same pause-or-delete choice.
- **v0.3**: Docker containers and compose projects as a job source.
- **v0.4**: systemd user units, so Linux gets the same job discovery as
  macOS.
- Open: a `--days` flag for the thresholds if people ask for it.

## License

MIT. Copyright 2026 Rohan Shah.
