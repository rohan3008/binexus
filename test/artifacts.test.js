import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { utimes } from 'node:fs/promises';
import { makeTmp, tree } from './helpers.js';
import { inspectTree } from '../skills/binexus/src/scan/artifacts.js';

test('sums bytes, lists artifacts, ignores artifacts and .git for mtime', async () => {
  const { dir, cleanup } = await makeTmp();
  await tree(dir, {
    'src/a.js': '12345',
    'node_modules/x/index.js': '1234567890',
    'web/dist/bundle.js': '123',
    'rust/target/x': '1',
    'rust2/Cargo.toml': '',
    'rust2/target/y': '12',
    '.git/HEAD': 'ref: x',
  });
  const old = new Date('2020-01-01T00:00:00Z');
  const newer = new Date('2024-06-01T00:00:00Z');
  await utimes(join(dir, 'src/a.js'), old, old);
  await utimes(join(dir, '.git/HEAD'), newer, newer);
  await utimes(join(dir, 'node_modules/x/index.js'), newer, newer);
  await utimes(join(dir, 'rust/target/x'), old, old);
  await utimes(join(dir, 'rust2/Cargo.toml'), old, old);

  const t = await inspectTree(dir);
  assert.equal(t.totalBytes, 5 + 10 + 3 + 1 + 2 + 6);
  assert.equal(t.artifactBytes, 10 + 3 + 2);
  assert.deepEqual(t.artifacts.map((a) => a.path).sort(), ['node_modules', 'rust2/target', 'web/dist']);
  assert.equal(t.newestSourceMtime, old.toISOString());
  await cleanup();
});
