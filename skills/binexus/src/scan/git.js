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

// Newest mtime across files git does not ignore (tracked + untracked-but-not-
// ignored). Logs, databases and run output are normally gitignored, and a
// background job writing them every day must not make a dead project look
// alive. Returns null when `dir` is not inside a git work tree.
export async function newestTrackedMtime(dir) {
  const { lstat } = await import('node:fs/promises');
  let listed;
  try {
    const { stdout } = await run('git', ['-C', dir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 64 * 1024 * 1024 });
    listed = stdout.split('\0').filter(Boolean);
  } catch { return null; }
  // ls-files run from a subdirectory lists paths relative to that subdirectory,
  // but a subdirectory that is entirely ignored yields nothing.
  let newest = 0;
  for (const rel of listed) {
    try {
      const st = await lstat(join(dir, rel));
      if (st.isFile() && st.mtimeMs > newest) newest = st.mtimeMs;
    } catch {}
  }
  return newest ? new Date(newest).toISOString() : null;
}
