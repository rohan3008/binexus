import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { makeTmp } from './helpers.js';
import { commentCronLine, pauseJob } from '../src/apply/pause.js';

test('commentCronLine comments exactly the matching line', () => {
  const text = '0 7 * * * a\n0 8 * * * b\n';
  assert.equal(commentCronLine(text, '0 8 * * * b', '2026-10-22'), '0 7 * * * a\n# binexus paused 2026-10-22: 0 8 * * * b\n');
});

test('launchd pause boots out and moves the plist', async () => {
  const { dir, cleanup } = await makeTmp();
  const plist = join(dir, 'agents', 'com.x.plist');
  await mkdir(join(dir, 'agents')); await writeFile(plist, '<plist/>');
  const calls = [];
  const sh = async (cmd, args) => { calls.push([cmd, ...args]); return ''; };
  await pauseJob({ kind: 'launchd', id: 'com.x', plist }, { sh, pausedDir: join(dir, 'paused'), uid: 501, date: '2026-10-22' });
  assert.deepEqual(calls, [['launchctl', 'bootout', 'gui/501/com.x']]);
  assert.deepEqual(await readdir(join(dir, 'paused')), ['com.x.plist']);
  await assert.rejects(readFile(plist));
  await cleanup();
});

test('cron pause rewrites the crontab through sh', async () => {
  const calls = [];
  const sh = async (cmd, args, input) => { calls.push([cmd, args, input]); return cmd === 'crontab' && args[0] === '-l' ? '0 8 * * * b\n' : ''; };
  await pauseJob({ kind: 'cron', id: 'b', line: '0 8 * * * b' }, { sh, date: '2026-10-22' });
  assert.deepEqual(calls[0], ['crontab', ['-l'], undefined]);
  assert.deepEqual(calls[1], ['crontab', ['-'], '# binexus paused 2026-10-22: 0 8 * * * b\n']);
});

test('pm2 pause stops by name', async () => {
  const calls = [];
  const sh = async (cmd, args) => { calls.push([cmd, ...args]); return ''; };
  await pauseJob({ kind: 'pm2', id: 'api', name: 'api' }, { sh });
  assert.deepEqual(calls, [['pm2', 'stop', 'api']]);
});
