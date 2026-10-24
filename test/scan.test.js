import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTmp, tree, initRepo, bareRepo } from './helpers.js';
import { scan } from '../skills/binexus/src/scan/index.js';

test('scan assembles a versioned report with attached and unmatched jobs', async () => {
  const { dir, cleanup } = await makeTmp();
  const root = join(dir, 'root');
  const remote = await bareRepo(join(dir, 'remote.git'));
  await tree(root, { 'proj/src/a.js': 'x', 'proj/node_modules/y/i.js': 'yy', 'loose/package.json': '{}' });
  await initRepo(join(root, 'proj'), { remote });
  const jobs = [
    { kind: 'launchd', id: 'com.proj', plist: '/p.plist', paths: [join(root, 'proj/run.sh')] },
    { kind: 'cron', id: 'other', line: 'x', paths: ['/elsewhere'] },
  ];
  const report = await scan(root, { jobs, now: Date.now() });
  assert.equal(report.version, 1);
  assert.equal(report.root, root);
  assert.equal(report.projects.length, 2);
  const proj = report.projects.find((p) => p.name === 'proj');
  assert.equal(proj.class, 'active');
  assert.equal(proj.protected, false);
  assert.deepEqual(proj.jobs.map((j) => j.id), ['com.proj']);
  assert.equal(proj.artifacts[0].path, 'node_modules');
  const loose = report.projects.find((p) => p.name === 'loose');
  assert.equal(loose.protected, true);
  assert.deepEqual(report.unmatchedJobs.map((j) => j.id), ['other']);
  await cleanup();
});
