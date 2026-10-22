---
name: binexus
description: Find dead vibe-coded projects and the background jobs they left running, then walk the user through pausing, stripping, or deleting each one. Use when the user wants to clean up old projects, free disk space, find what is still running in the background, or says "binexus".
---

# binexus

You are the brain. The `binexus` CLI is the hands. You never modify a project
or a job yourself. You scan, you ask, you write a plan. The user runs apply.

## 1. Scan

Ask which folder to scan if the user did not say. A sensible default is the
folder where they keep projects (often `~/Documents`, `~/code`, `~/dev`,
`~/projects`). Then run:

    npx binexus scan <root> --out <root>/binexus-report.json

Read the JSON. Each project has:

- `class`: `active` (touched in 30 days), `idle` (31 to 120 days), `stale` (older)
- `protected`: true when there are unpushed commits, uncommitted changes, no
  upstream remote, or the folder is not a git repo. Deleting it could lose
  work that exists nowhere else.
- `artifacts`: regenerable directories (node_modules, .venv, build, dist,
  DerivedData, ...) with byte sizes
- `jobs`: launchd, cron, or pm2 entries whose paths point inside the project

## 2. Summary screen

Show one short summary:

- counts by class and the total artifact size in MB or GB
- every job attached to an idle or stale project, listed first. These keep
  running and the user has probably forgotten them.
- `unmatchedJobs` in one line, no action proposed

## 3. One project at a time

Order: stale with jobs, then idle with jobs, then stale by `artifactBytes`
descending, then idle by `artifactBytes` descending. Skip active projects
unless the user asks.

For each project show: name, class, last activity date, total size, artifact
list, jobs, whether it is protected and why, and your recommendation. Then
ask the user to pick exactly one:

- **keep**: do nothing
- **pause**: stop its background jobs, touch nothing else
- **strip**: delete regenerable artifacts only, keep source and git
- **delete**: move the whole folder to `~/.binexus/trash` (restorable with
  `npx binexus restore`). Attached jobs are paused first.

If the user is unsure, offer to look inside: read the README, `git log`, and
recent files. You may read. You must not edit, install, or run the project.

Protected projects: say what protects them. A delete needs the user to say
explicitly that they accept losing the unpushed or uncommitted work. Only
then set `acknowledgeProtected: true` on that action. Never set it on your
own initiative. The applier will still make them type the project name.

## 4. Write the plan

Write `<root>/binexus-plan.json`:

    {
      "version": 1,
      "reportPath": "<absolute path to binexus-report.json>",
      "actions": [
        {"path": "<absolute project path>", "action": "pause"},
        {"path": "<absolute project path>", "action": "strip"},
        {"path": "<absolute project path>", "action": "delete", "acknowledgeProtected": true}
      ]
    }

Only include projects the user chose an action for. `keep` is not an action.
Then tell the user to run:

    npx binexus apply <root>/binexus-plan.json

It confirms every action again before acting, and nothing is ever unlinked.
Do not run apply yourself.
