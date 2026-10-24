import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTmp, tree } from './helpers.js';
import { findProjects } from '../skills/binexus/src/scan/walk.js';

test('finds project roots by marker and does not descend into them', async () => {
  const { dir, cleanup } = await makeTmp();
  await tree(dir, {
    'a/package.json': '{}',
    'a/sub/package.json': '{}',
    'b/.git/HEAD': 'ref',
    'c/pyproject.toml': '',
    'd/Package.swift': '',
    'e/App.xcodeproj/project.pbxproj': '',
    'f/notes.txt': 'not a project',
    'f/deeper/package.json': '{}',
    'node_modules/x/package.json': '{}',
    '.hidden/package.json': '{}',
  });
  const found = await findProjects(dir);
  assert.deepEqual(found, ['a', 'b', 'c', 'd', 'e', 'f/deeper'].map((p) => join(dir, p)));
  await cleanup();
});

test('a root that is itself a project returns just the root', async () => {
  const { dir, cleanup } = await makeTmp();
  await tree(dir, { 'package.json': '{}', 'sub/package.json': '{}' });
  assert.deepEqual(await findProjects(dir), [dir]);
  await cleanup();
});
