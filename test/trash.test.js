import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { makeTmp, tree } from './helpers.js';
import { deleteProject, listTrash, restoreProject } from '../skills/binexus/src/apply/trash.js';

test('delete moves to trash with manifest; list and restore round-trip', async () => {
  const { dir, cleanup } = await makeTmp();
  const proj = join(dir, 'proj');
  await tree(proj, { 'a.txt': 'hi' });
  const trashDir = join(dir, 'trash');
  const project = { path: proj, name: 'proj', class: 'stale' };

  const dest = await deleteProject(project, { trashDir, date: '2026-10-22' });
  assert.equal(dest, join(trashDir, '2026-10-22-proj'));
  await assert.rejects(access(proj));
  assert.equal(await readFile(join(dest, 'a.txt'), 'utf8'), 'hi');
  const manifest = JSON.parse(await readFile(join(trashDir, '2026-10-22-proj.manifest.json'), 'utf8'));
  assert.equal(manifest.originalPath, proj);
  assert.equal(manifest.project.name, 'proj');

  assert.deepEqual(await listTrash(trashDir), [{ name: '2026-10-22-proj', originalPath: proj, deletedAt: '2026-10-22' }]);

  await restoreProject('2026-10-22-proj', { trashDir });
  assert.equal(await readFile(join(proj, 'a.txt'), 'utf8'), 'hi');
  assert.deepEqual(await listTrash(trashDir), []);
  await cleanup();
});

test('second delete the same day gets a suffix; restore refuses if path exists', async () => {
  const { dir, cleanup } = await makeTmp();
  const trashDir = join(dir, 'trash');
  const p1 = join(dir, 'x'); await tree(p1, { f: '1' });
  const d1 = await deleteProject({ path: p1, name: 'x' }, { trashDir, date: '2026-10-22' });
  await tree(p1, { f: '2' });
  const d2 = await deleteProject({ path: p1, name: 'x' }, { trashDir, date: '2026-10-22' });
  assert.equal(d1, join(trashDir, '2026-10-22-x'));
  assert.equal(d2, join(trashDir, '2026-10-22-x-2'));
  await tree(p1, { f: '3' });
  await assert.rejects(restoreProject('2026-10-22-x', { trashDir }), /already exists/);
  await cleanup();
});
