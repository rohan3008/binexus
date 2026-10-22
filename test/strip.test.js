import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { makeTmp, tree } from './helpers.js';
import { stripArtifacts } from '../src/apply/strip.js';

test('removes only listed artifact dirs inside the project', async () => {
  const { dir, cleanup } = await makeTmp();
  await tree(dir, { 'src/a.js': 'keep', 'node_modules/x': 'rm', 'web/dist/b': 'rm' });
  const removed = await stripArtifacts({ path: dir, artifacts: [{ path: 'node_modules', bytes: 2 }, { path: 'web/dist', bytes: 2 }] });
  assert.deepEqual(removed, [join(dir, 'node_modules'), join(dir, 'web/dist')]);
  assert.equal(await readFile(join(dir, 'src/a.js'), 'utf8'), 'keep');
  await assert.rejects(access(join(dir, 'node_modules')));
  await cleanup();
});

test('refuses artifact paths that escape the project', async () => {
  const { dir, cleanup } = await makeTmp();
  await assert.rejects(stripArtifacts({ path: dir, artifacts: [{ path: '../outside', bytes: 1 }] }), /outside project/);
  await assert.rejects(stripArtifacts({ path: dir, artifacts: [{ path: '/etc', bytes: 1 }] }), /outside project/);
  await cleanup();
});
