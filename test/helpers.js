import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export async function makeTmp() {
  const dir = await mkdtemp(join(tmpdir(), 'binexus-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

// Create files from a map of relative path -> content. Directories are
// created as needed. A value of null creates an empty directory.
export async function tree(root, files) {
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    if (content === null) { await mkdir(abs, { recursive: true }); continue; }
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content);
  }
}

export async function git(dir, ...args) {
  const { stdout } = await run('git', ['-C', dir, ...args], {
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
  });
  return stdout.trim();
}

// Make `dir` a git repo with one commit. If `remote` is a path to a bare
// repo, push to it so the branch has an upstream.
export async function initRepo(dir, { remote } = {}) {
  await git(dir, 'init', '-q', '-b', 'main');
  await writeFile(join(dir, 'README.md'), 'x');
  await git(dir, 'add', '.');
  await git(dir, 'commit', '-qm', 'init');
  if (remote) {
    await git(dir, 'remote', 'add', 'origin', remote);
    await git(dir, 'push', '-q', '-u', 'origin', 'main');
  }
}

export async function bareRepo(path) {
  await mkdir(path, { recursive: true });
  await run('git', ['init', '-q', '--bare', '-b', 'main', path]);
  return path;
}
