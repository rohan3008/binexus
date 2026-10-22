import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

const run = promisify(execFile);

async function git(dir, args) {
  const { stdout } = await run('git', ['-C', dir, ...args]);
  return stdout.trim();
}

export async function gitSignals(dir) {
  const none = { isGit: false, lastCommit: null, unpushedCommits: null, uncommittedChanges: false, hasUpstream: false };
  try { await access(join(dir, '.git')); } catch { return none; }

  let lastCommit = null;
  try { lastCommit = (await git(dir, ['log', '-1', '--format=%cI'])) || null; } catch {}

  let uncommittedChanges = false;
  try { uncommittedChanges = (await git(dir, ['status', '--porcelain'])) !== ''; } catch {}

  let hasUpstream = false;
  let unpushedCommits = null;
  try {
    await git(dir, ['rev-parse', '--abbrev-ref', '@{u}']);
    hasUpstream = true;
    unpushedCommits = Number(await git(dir, ['rev-list', '--count', '@{u}..HEAD']));
  } catch {}

  return { isGit: true, lastCommit, unpushedCommits, uncommittedChanges, hasUpstream };
}
