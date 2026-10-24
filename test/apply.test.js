import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { makeTmp, tree } from './helpers.js';
import { apply } from '../skills/binexus/src/apply/index.js';

function deps(dir, answers) {
  const log = [];
  const calls = [];
  return {
    d: {
      home: dir, date: '2026-10-22', uid: 501,
      sh: async (cmd, args) => { calls.push([cmd, ...args]); return ''; },
      prompt: { confirm: async () => answers.confirm, typed: async (_q, e) => answers.typed === e },
      recheck: async (p) => ({ protected: p.protected }),
      log: (m) => log.push(m),
    },
    log, calls,
  };
}

test('declined prompt leaves everything untouched', async () => {
  const { dir, cleanup } = await makeTmp();
  const proj = join(dir, 'p'); await tree(proj, { 'node_modules/x': '1' });
  const report = { version: 1, projects: [{ path: proj, name: 'p', protected: false, artifacts: [{ path: 'node_modules', bytes: 1 }], jobs: [] }] };
  const plan = { version: 1, actions: [{ path: proj, action: 'strip' }] };
  const { d } = deps(dir, { confirm: false });
  const result = await apply(plan, report, d);
  assert.deepEqual(result, [{ path: proj, action: 'strip', status: 'skipped' }]);
  await access(join(proj, 'node_modules'));
  await cleanup();
});

test('strip, pause and delete run when confirmed; delete pauses attached jobs first', async () => {
  const { dir, cleanup } = await makeTmp();
  const proj = join(dir, 'p'); await tree(proj, { 'node_modules/x': '1', 'src/a': 'a' });
  const plist = join(dir, 'com.p.plist'); await tree(dir, { 'com.p.plist': '<plist/>' });
  const job = { kind: 'launchd', id: 'com.p', plist, paths: [proj] };
  const report = { version: 1, projects: [{ path: proj, name: 'p', protected: false, artifacts: [{ path: 'node_modules', bytes: 1 }], jobs: [job] }] };
  const plan = { version: 1, actions: [{ path: proj, action: 'strip' }, { path: proj, action: 'delete' }] };
  const { d, calls } = deps(dir, { confirm: true });
  const result = await apply(plan, report, d);
  assert.deepEqual(result.map((r) => r.status), ['done', 'done']);
  assert.deepEqual(calls, [['launchctl', 'bootout', 'gui/501/com.p']]);
  await assert.rejects(access(proj));
  assert.equal(await readFile(join(dir, '.binexus/trash/2026-10-22-p/src/a'), 'utf8'), 'a');
  await assert.rejects(access(join(dir, '.binexus/trash/2026-10-22-p/node_modules')));
  await cleanup();
});

test('protected delete is refused without acknowledgement, and needs the typed name with it', async () => {
  const { dir, cleanup } = await makeTmp();
  const proj = join(dir, 'p'); await tree(proj, { a: 'a' });
  const project = { path: proj, name: 'p', protected: true, artifacts: [], jobs: [] };
  const report = { version: 1, projects: [project] };

  let r = await apply({ version: 1, actions: [{ path: proj, action: 'delete' }] }, report, deps(dir, { confirm: true }).d);
  assert.equal(r[0].status, 'refused');
  await access(proj);

  r = await apply({ version: 1, actions: [{ path: proj, action: 'delete', acknowledgeProtected: true }] }, report, deps(dir, { confirm: true, typed: 'wrong' }).d);
  assert.equal(r[0].status, 'skipped');
  await access(proj);

  r = await apply({ version: 1, actions: [{ path: proj, action: 'delete', acknowledgeProtected: true }] }, report, deps(dir, { confirm: true, typed: 'p' }).d);
  assert.equal(r[0].status, 'done');
  await assert.rejects(access(proj));
  await cleanup();
});

test('recheck at apply time can newly protect a project', async () => {
  const { dir, cleanup } = await makeTmp();
  const proj = join(dir, 'p'); await tree(proj, { a: 'a' });
  const report = { version: 1, projects: [{ path: proj, name: 'p', protected: false, artifacts: [], jobs: [] }] };
  const { d } = deps(dir, { confirm: true });
  d.recheck = async () => ({ protected: true });
  const r = await apply({ version: 1, actions: [{ path: proj, action: 'delete' }] }, report, d);
  assert.equal(r[0].status, 'refused');
  await access(proj);
  await cleanup();
});
