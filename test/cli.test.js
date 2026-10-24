import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { makeTmp, tree } from './helpers.js';

const BIN = new URL('../bin/binexus.js', import.meta.url).pathname;

function run(args, { input, env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], { env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
    child.stdin.end(input);
  });
}

test('apply answers several prompts from piped stdin and prints the summary', async () => {
  const { dir, cleanup } = await makeTmp();
  const a = join(dir, 'a'); const b = join(dir, 'b');
  await tree(a, { 'node_modules/x': '1' }); await tree(b, { 'dist/y': '1' });
  const report = { version: 1, projects: [
    { path: a, name: 'a', protected: false, artifacts: [{ path: 'node_modules', bytes: 1 }], jobs: [] },
    { path: b, name: 'b', protected: false, artifacts: [{ path: 'dist', bytes: 1 }], jobs: [] },
  ] };
  await writeFile(join(dir, 'report.json'), JSON.stringify(report));
  await writeFile(join(dir, 'plan.json'), JSON.stringify({ version: 1, reportPath: join(dir, 'report.json'), actions: [
    { path: a, action: 'strip' }, { path: b, action: 'strip' },
  ] }));
  const { code, out } = await run(['apply', join(dir, 'plan.json')], { input: 'y\nn\n', env: { BINEXUS_HOME: join(dir, 'home') } });
  assert.equal(code, 0, out);
  assert.match(out, /DONE: STRIP node_modules from a/);
  assert.match(out, /SKIPPED: STRIP dist from b/);
  assert.match(out, /1 done, 1 skipped, 0 refused, 0 errors/);
  await assert.rejects(access(join(a, 'node_modules')));
  await access(join(b, 'dist'));
  await cleanup();
});

test('apply treats end of input as no', async () => {
  const { dir, cleanup } = await makeTmp();
  const a = join(dir, 'a'); await tree(a, { 'node_modules/x': '1' });
  const report = { version: 1, projects: [{ path: a, name: 'a', protected: false, artifacts: [{ path: 'node_modules', bytes: 1 }], jobs: [] }] };
  await writeFile(join(dir, 'report.json'), JSON.stringify(report));
  await writeFile(join(dir, 'plan.json'), JSON.stringify({ version: 1, reportPath: join(dir, 'report.json'), actions: [{ path: a, action: 'strip' }] }));
  const { code, out } = await run(['apply', join(dir, 'plan.json')], { input: '', env: { BINEXUS_HOME: join(dir, 'home') } });
  assert.equal(code, 0, out);
  assert.match(out, /0 done, 1 skipped/);
  await access(join(a, 'node_modules'));
  await cleanup();
});
