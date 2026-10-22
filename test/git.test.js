import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { makeTmp, tree, initRepo, bareRepo, git } from './helpers.js';
import { gitSignals } from '../src/scan/git.js';

test('non-git folder', async () => {
  const { dir, cleanup } = await makeTmp();
  await tree(dir, { 'x.txt': '' });
  assert.deepEqual(await gitSignals(dir), {
    isGit: false, lastCommit: null, unpushedCommits: null, uncommittedChanges: false, hasUpstream: false,
  });
  await cleanup();
});

test('clean repo with upstream and nothing unpushed', async () => {
  const { dir, cleanup } = await makeTmp();
  const remote = await bareRepo(join(dir, 'remote.git'));
  const repo = join(dir, 'repo'); await tree(repo, {});
  await initRepo(repo, { remote });
  const s = await gitSignals(repo);
  assert.equal(s.isGit, true);
  assert.equal(s.hasUpstream, true);
  assert.equal(s.unpushedCommits, 0);
  assert.equal(s.uncommittedChanges, false);
  assert.match(s.lastCommit, /^\d{4}-\d{2}-\d{2}T/);
  await cleanup();
});

test('unpushed commit and dirty tree are reported', async () => {
  const { dir, cleanup } = await makeTmp();
  const remote = await bareRepo(join(dir, 'remote.git'));
  const repo = join(dir, 'repo'); await tree(repo, {});
  await initRepo(repo, { remote });
  await writeFile(join(repo, 'a.txt'), 'a');
  await git(repo, 'add', '.'); await git(repo, 'commit', '-qm', 'two');
  await writeFile(join(repo, 'b.txt'), 'b');
  const s = await gitSignals(repo);
  assert.equal(s.unpushedCommits, 1);
  assert.equal(s.uncommittedChanges, true);
  await cleanup();
});

test('repo without upstream', async () => {
  const { dir, cleanup } = await makeTmp();
  await initRepo(dir);
  const s = await gitSignals(dir);
  assert.equal(s.hasUpstream, false);
  assert.equal(s.unpushedCommits, null);
  await cleanup();
});
