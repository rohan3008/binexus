# binexus — design spec

Date: 2026-10-22
Status: approved in brainstorm, awaiting written-spec review

## What it is

A CLI plus an agent skill that finds dead vibe-coded projects on a developer's
machine, finds background jobs those projects left running, and walks the user
through pausing, stripping, or deleting each one. The human decides every
action. The tool never acts on its own.

Open source, MIT, GitHub `rohan3008/binexus`, npm package `binexus`.

## Why

A developer who builds many AI-assisted projects ends up with dozens of
folders, gigabytes of regenerable build artifacts, and background jobs
(launchd, cron, pm2) that keep running for projects they stopped touching
months ago. Disk cleaners count bytes. They do not know a project is dead,
and they never look at background jobs. binexus does both.

Measured on the author's machine on 2026-10-22: 31 git projects, 10 untouched
for 4+ months, 1.6 GB of node_modules, 3 of 5 user launchd agents belonging
to projects with no commit since June or July.

## Non-goals for v1

- Cloud resources (Fly, Vercel, DigitalOcean, Convex). v2.
- A built-in LLM call. The user's coding agent is the brain.
- True unlink. "Delete" means move to a trash folder.
- Windows. macOS first, Linux where the code happens to work.
- Docker containers. v2.

## Architecture

Four parts. Each has one job and can be tested alone.

```
npx binexus scan ~/Documents  ──►  report.json
                                       │
          SKILL.md (user's agent)  ◄───┘
          asks the user per project
                                       │
                                       ▼
npx binexus apply plan.json   ◄───  plan.json
   re-asks per action, executes
                                       │
npx binexus restore <name>    ◄───  ~/.binexus/trash/
```

### Scanner — `binexus scan [root] [--out report.json]`

Read-only. Walks `root` (default: cwd). A folder is a project if it directly
contains any of: `.git`, `package.json`, `pyproject.toml`, `Package.swift`,
`*.xcodeproj`. The walker does not descend into a project folder looking for
nested projects, and skips `node_modules`, `.git`, and hidden folders.

Per project it collects:

| Signal | Source |
|---|---|
| `lastCommit` | `git log -1 --format=%cI`, null if not git |
| `newestSourceMtime` | newest mtime of any file not inside an artifact dir |
| `unpushedCommits` | `git log @{u}..HEAD --oneline | wc -l`; null if no upstream, which also counts as protected |
| `uncommittedChanges` | `git status --porcelain` non-empty |
| `totalBytes` | `du` of the folder |
| `artifactBytes` | sum of regenerable artifact dirs present |
| `artifacts` | list of `{path, bytes}` for each regenerable dir found |
| `jobs` | background jobs whose command path lies inside the folder |

Regenerable artifact dirs, matched by name at any depth inside the project
but not inside another artifact dir: `node_modules`, `.venv`, `venv`,
`.build`, `build`, `dist`, `DerivedData`, `.next`, `.turbo`, `.cache`,
`__pycache__`, `.pytest_cache`, `target` (only if `Cargo.toml` is a sibling).

Background job sources:

- launchd: every plist in `~/Library/LaunchAgents`. Parse `ProgramArguments`
  and `Program`, plus `WorkingDirectory`. A job belongs to a project if any
  of those paths resolves inside the project folder.
- cron: `crontab -l` lines. Same path test on the command text.
- pm2: `pm2 jlist` if `pm2` is on PATH. Same path test on `pm_exec_path`
  and `pm_cwd`.

Classification is deterministic and uses the most recent of `lastCommit` and
`newestSourceMtime` as `lastActivity`:

- `active`: lastActivity within 30 days
- `idle`: 30 to 120 days
- `stale`: over 120 days

Separately, `protected: true` when `unpushedCommits > 0`, or
`uncommittedChanges`, or the repo has no upstream, or the folder is not a git
repo at all. Protected means delete needs an explicit acknowledgement.

The classification is a starting point for the agent, not a verdict.

### Skill — `SKILL.md`

Installed into the user's agent with `npx skills add rohan3008/binexus`.
It instructs the agent to:

1. Run `npx binexus scan <root>` with the root the user names.
2. Read `report.json` and show one summary screen: project counts by
   class, total and artifact bytes, and every background job tied to an
   idle or stale project, listed first because those are the quiet cost.
3. Go through projects one at a time, highest payoff first. Payoff order:
   stale with a job, then idle with a job, then stale by artifact bytes,
   then idle by artifact bytes. Active projects are not raised unless the
   user asks.
4. For each project show the signals and a recommended action, then ask
   the user to choose: keep, pause, strip, or delete. The user may ask the
   agent to look inside the folder before deciding. The agent may read the
   project but must not modify it.
5. Write `plan.json` and tell the user the exact apply command.
6. Never run `binexus apply` itself. The user runs it.

### Applier — `binexus apply plan.json [--yes-to-strip]`

Reads the plan, validates it against the schema, and for each entry prints
exactly what will happen and asks `[y/N]`. Default is no. Then executes.

| Action | Effect | Undo |
|---|---|---|
| `pause` | launchd: `launchctl bootout gui/$UID <plist>` and move the plist to `~/.binexus/paused/`. cron: comment the line out with a `# binexus paused <date>` marker. pm2: `pm2 stop <name>`. | Move plist back and `launchctl bootstrap`; uncomment; `pm2 start`. Documented, not automated in v1. |
| `strip` | Delete the artifact dirs listed in the report for that project. Nothing else. | Reinstall. |
| `delete` | Apply `pause` to any attached job, then move the folder to `~/.binexus/trash/<YYYY-MM-DD>-<name>/` and write `manifest.json` beside it with the original path and the report entry. | `binexus restore`. |

Gates:

- A `delete` on a `protected` project is refused unless the plan entry has
  `acknowledgeProtected: true`, and then the applier additionally requires
  the user to type the project's folder name to confirm.
- `--yes-to-strip` skips the per-action prompt for `strip` only. Pause and
  delete always prompt.
- The applier re-runs the protected checks at apply time. A project that
  became protected after the scan is treated as protected.
- Nothing is ever unlinked. The user empties `~/.binexus/trash` by hand.

### Restore — `binexus restore <name>`

Lists trash entries if no name is given. With a name, moves the folder back
to the path in its manifest, refusing if that path now exists. Does not
re-enable paused jobs; prints how.

## File formats

Both carry `"version": 1`.

`report.json`:

```json
{
  "version": 1,
  "root": "/Users/x/Documents",
  "scannedAt": "2026-10-22T10:00:00Z",
  "projects": [
    {
      "path": "/Users/x/Documents/edgefinder",
      "name": "edgefinder",
      "class": "stale",
      "protected": false,
      "lastCommit": "2026-06-26T09:12:00Z",
      "newestSourceMtime": "2026-06-26T09:12:00Z",
      "unpushedCommits": 0,
      "uncommittedChanges": false,
      "totalBytes": 104857600,
      "artifactBytes": 83886080,
      "artifacts": [{"path": "node_modules", "bytes": 83886080}],
      "jobs": [{"kind": "launchd", "id": "com.edgefinder.daily",
                "plist": "/Users/x/Library/LaunchAgents/com.edgefinder.daily.plist"}]
    }
  ],
  "unmatchedJobs": []
}
```

`unmatchedJobs` lists user jobs whose paths point nowhere under root, so the
agent can mention them without acting on them.

`plan.json`:

```json
{
  "version": 1,
  "reportPath": "/Users/x/Documents/report.json",
  "actions": [
    {"path": "/Users/x/Documents/edgefinder", "action": "pause"},
    {"path": "/Users/x/Documents/moonscanner", "action": "delete"},
    {"path": "/Users/x/Documents/polya", "action": "strip"},
    {"path": "/Users/x/Documents/old-thing", "action": "delete",
     "acknowledgeProtected": true}
  ]
}
```

The applier reads artifact and job details from `reportPath`, so a plan is
only valid with the report it was built from.

## Code layout

```
binexus/
  bin/binexus.js          entry, dispatches subcommands
  src/scan/walk.js        find project folders
  src/scan/git.js         git signals
  src/scan/artifacts.js   regenerable dir detection and sizing
  src/scan/jobs.js        launchd, cron, pm2 discovery
  src/scan/classify.js    active/idle/stale + protected
  src/scan/index.js       assembles report.json
  src/apply/index.js      plan validation, prompts, dispatch
  src/apply/pause.js
  src/apply/strip.js
  src/apply/delete.js
  src/apply/restore.js
  src/prompt.js           y/N and typed-name prompts
  SKILL.md
  test/                   node:test, fixtures built in temp dirs
  package.json            "bin": {"binexus": "bin/binexus.js"}, no deps
```

Plain JavaScript (ES modules), Node 20+, zero runtime dependencies so
`npx binexus` starts fast. Node's built-in `node:test` for tests.

## Testing

- **walk**: fixture tree with nested and sibling projects, hidden dirs,
  node_modules containing a package.json. Asserts exactly the intended
  roots are found.
- **git**: temp repos with and without upstream, with unpushed commits,
  with dirty tree. Asserts each signal and `protected`.
- **artifacts**: fixture with node_modules, .venv, nested build dirs, and a
  `target` with and without Cargo.toml. Asserts list and byte sums.
- **jobs**: fixture plists and a fake crontab string pointing inside and
  outside projects. Asserts matching. pm2 tested with a stubbed `jlist`.
- **classify**: boundary dates at 30 and 120 days.
- **apply**: dry-run against fixtures asserts the printed plan. Real run
  against a temp dir asserts strip removes only artifacts, delete moves to
  trash with a correct manifest, restore round-trips, protected delete
  without acknowledgement is refused, and a prompt answer of `n` leaves
  everything untouched. launchctl and pm2 calls are shelled through one
  function that tests replace.
- **end-to-end**: scan a fixture root, assert `report.json` matches the
  schema the skill depends on.

Never touch the real `~/Library/LaunchAgents` or real crontab in tests.

## Distribution

- README leads with `npx skills add rohan3008/binexus` and a terminal
  recording of a scan on a messy machine ending in the summary screen.
- Second line: `npx binexus scan ~/Documents` for people with no agent.
- Listed on skills.sh and similar marketplaces after the first npm release.
- One launch post built around the measured result on the author's machine.

## Decisions log

- 2026-10-22: Option B chosen (CLI is the hands, the user's agent is the
  brain) over a CLI with its own Claude API call. Reason: no API-key wall,
  the agent can inspect a project to judge it, and the AI never touches
  disk, which keeps the dangerous path deterministic.
- 2026-10-22: local-only v1, cloud is v2.
- 2026-10-22: "delete" is a trash move, never unlink.
- 2026-10-22: human confirms twice, once in the agent conversation and
  once in the applier.
