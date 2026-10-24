# Anthropic plugin directory: submission kit

Everything to paste or click at https://claude.ai/directory/manage. The
portal reads the listing from `plugin.json` and the README, so the only
typing is the data-handling answers. Prerequisites and the full flow are
in https://claude.com/docs/plugins/submit.

## Before you start

- Sign in to claude.ai on a plan that can submit (Pro, Max, or Team/Enterprise
  owner).
- Connect the GitHub account `rohan3008` to claude.ai in that organization.
  The portal checks that the account can push to the repo.
- The repo is public, passes `claude plugin validate --strict`, has a
  README over 40 words, a LICENSE, no launchers, no binaries, no system
  files, and no lockfile. All checked on 2026-10-24.

## Submit new -> Plugin bundle -> Source

| Field | Value |
|---|---|
| Repository | `rohan3008/binexus` |
| Plugin path (optional) | leave empty; the plugin is at the repo root |
| Branch or tag (optional) | leave empty; follows `main` |

Click **Validate**. Expected: no Blocking findings. If anything blocks,
copy the finding text to Claude Code and it will fix and push.

## Listing details

Read from `plugin.json` and the README. Nothing to type. Expected:

- Name: binexus
- Short description: "Find dead vibe-coded projects and the background
  jobs they left running. Your agent asks you project by project what to
  pause, strip, or delete; nothing is ever unlinked."
- Author: Rohan Shah
- Homepage: https://rohan3008.github.io/binexus/
- License: MIT

## Data handling

| Question | Answer | Why |
|---|---|---|
| Does the plugin read or store personal data? | No | It reads file paths, sizes, timestamps and git metadata on the user's own machine and writes them to a local report file. Nothing leaves the machine. |
| Does it send data to services other than its declared connectors? | No | There is no network code. It declares no connectors or MCP servers. |
| How long does it keep data? | Only locally, under the user's control | `binexus-report.json` and `binexus-plan.json` sit in the scanned folder; `~/.binexus/trash` holds projects the user chose to delete until the user empties it. |
| Is it intended for people under 18? | No | Developer tool. |

## Compliance

- Contact email: rohanshah90@gmail.com (confirm it is the one you want
  Anthropic to use)
- Tick all four acknowledgements.

## Review and submit

- How new versions reach the directory: keep **GitHub push webhook**.
- Auto-publish passing versions: on, if offered.
- Click **Submit for review**, then **Set up push updates** (needs admin on
  the repo, which you have).

## After submitting

- Status appears under Submissions. A first version that passes still needs
  an Anthropic reviewer to publish it.
- Every later release is just a push to `main` with `version` raised in
  `.claude-plugin/plugin.json` and `package.json`.
- If a version is held, the Review tab lists the finding. Paste it to
  Claude Code.
