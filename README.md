# binexus

Find the dead vibe-coded projects on your machine and the background jobs
they left running. You decide what to pause, strip, or delete. binexus never
deletes anything on its own, and it never unlinks a file: "delete" means a
move to a trash folder you can restore from.

## Install into your coding agent

```
npx skills add rohan3008/binexus
```

Then tell Claude Code, Cursor, Codex, or whichever agent you use:

> run binexus on ~/Documents

The agent scans, shows you what it found, and asks you project by project
what to do. It writes a plan file. You run the plan. Every action is
confirmed again at that point.

## Use it without an agent

```
npx binexus scan ~/Documents          # read-only, writes report.json
npx binexus apply plan.json           # confirms each action, then acts
npx binexus restore                   # list the trash
npx binexus restore 2026-10-22-name   # put one project back
```

`plan.json` is a list of `{path, action}` where action is `pause`, `strip`,
or `delete`. See `SKILL.md` for the exact shape.

## What it looks for

A project is any folder with `.git`, `package.json`, `pyproject.toml`,
`Package.swift`, or an `.xcodeproj`. For each one:

| Signal | Meaning |
|---|---|
| last commit, newest source file | last activity. Build artifacts and `.git` internals do not count. |
| class | `active` under 30 days, `idle` to 120 days, `stale` beyond |
| protected | unpushed commits, uncommitted changes, no upstream, or not git. Deleting could lose work that exists nowhere else. |
| artifacts | `node_modules`, `.venv`, `venv`, `build`, `dist`, `.build`, `DerivedData`, `.next`, `.turbo`, `.cache`, `__pycache__`, `.pytest_cache`, Rust `target` |
| jobs | launchd agents in `~/Library/LaunchAgents`, crontab lines, pm2 processes whose paths point inside the project |

The jobs are the part nothing else catches. A daily launchd agent for a
project you abandoned in June is still waking up every morning.

## The three actions

| Action | Does | Undo |
|---|---|---|
| pause | Unloads the launchd agent and moves its plist to `~/.binexus/paused`. Comments out the cron line. `pm2 stop`. | Move the plist back and `launchctl bootstrap gui/$(id -u) <plist>`. Uncomment. `pm2 start`. |
| strip | Deletes the artifact dirs listed in the report. Source and `.git` untouched. | Reinstall. |
| delete | Pauses attached jobs, then moves the folder to `~/.binexus/trash/<date>-<name>` with a manifest. | `npx binexus restore <name>` |

## Safety rules

- Nothing is unlinked. You empty `~/.binexus/trash` yourself when you are sure.
- Every action is confirmed at apply time, default no. `--yes-to-strip`
  skips the prompt for strip only.
- A protected project cannot be deleted unless the plan carries
  `acknowledgeProtected: true`, and then you must type the project's name.
- Protection is rechecked at apply time, not just at scan time.
- The scanner is read-only. Tests never touch real launchd agents or crontab.
- Set `BINEXUS_HOME` to put the trash on the same volume as your projects if
  a move fails with EXDEV.

## Not in v1

Cloud resources (Fly, Vercel, DigitalOcean), Docker containers, Windows.

## License

MIT
