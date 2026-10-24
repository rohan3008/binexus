#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { scan } from '../src/scan/index.js';
import { apply, binexusHome } from '../src/apply/index.js';
import { listTrash, restoreProject } from '../src/apply/trash.js';
import { closePrompt } from '../src/prompt.js';

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--out');
const mb = (b) => `${(b / 1048576).toFixed(0)} MB`;

const usage = `binexus -- find dead projects and the jobs they left running. You decide.

  binexus scan [root] [--out report.json]   read-only, writes report.json
  binexus apply plan.json [--yes-to-strip]  confirms every action, then acts
  binexus restore [name]                    list trash, or restore one entry

Nothing is ever unlinked. Deleted projects go to ${binexusHome(homedir())}/trash.`;

async function main() {
  if (cmd === 'scan') {
    const root = resolve(args[0] ?? '.');
    const outIdx = rest.indexOf('--out');
    const out = outIdx >= 0 && rest[outIdx + 1] ? resolve(rest[outIdx + 1]) : resolve('report.json');
    process.stderr.write(`scanning ${root}\n`);
    const report = await scan(root, { onProgress: (p) => process.stderr.write(`  ${p}\n`) });
    await writeFile(out, JSON.stringify(report, null, 2));
    const by = (c) => report.projects.filter((p) => p.class === c);
    const withJobs = report.projects.filter((p) => p.jobs.length && p.class !== 'active');
    const artifactTotal = report.projects.reduce((s, p) => s + p.artifactBytes, 0);
    console.log(`\n${report.projects.length} projects: ${by('active').length} active, ${by('idle').length} idle, ${by('stale').length} stale`);
    console.log(`${mb(artifactTotal)} of regenerable artifacts (node_modules, .venv, build, ...)`);
    if (withJobs.length) {
      console.log('\nBackground jobs still running for idle/stale projects:');
      for (const p of withJobs) for (const j of p.jobs) console.log(`  ${p.class.padEnd(5)} ${p.name}  <- ${j.kind}:${j.id}`);
    }
    if (report.unmatchedJobs.length) console.log(`\n${report.unmatchedJobs.length} user job(s) point outside ${root} (see unmatchedJobs in the report)`);
    console.log(`\nreport written to ${out}`);
    return;
  }
  if (cmd === 'apply') {
    if (!args[0]) throw new Error('usage: binexus apply plan.json');
    const planPath = resolve(args[0]);
    const plan = JSON.parse(await readFile(planPath, 'utf8'));
    const reportPath = resolve(plan.reportPath ?? join(planPath, '..', 'report.json'));
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const results = await apply(plan, report, { yesToStrip: flags.has('--yes-to-strip') });
    closePrompt();
    const n = (s) => results.filter((r) => r.status === s).length;
    console.log(`\n${n('done')} done, ${n('skipped')} skipped, ${n('refused')} refused, ${n('error')} errors`);
    return;
  }
  if (cmd === 'restore') {
    const base = binexusHome(homedir());
    const trashDir = join(base, 'trash');
    if (!args[0]) {
      const items = await listTrash(trashDir);
      if (!items.length) { console.log(`trash is empty (${trashDir})`); return; }
      for (const i of items) console.log(`${i.name}  <- ${i.originalPath}`);
      console.log('\nbinexus restore <name>');
      return;
    }
    const dest = await restoreProject(args[0], { trashDir });
    console.log(`restored to ${dest}`);
    console.log(`Paused jobs are not re-enabled. Plists are in ${base}/paused; move one back to ~/Library/LaunchAgents and run: launchctl bootstrap gui/$(id -u) <plist>`);
    return;
  }
  console.log(usage);
  if (cmd && cmd !== 'help' && cmd !== '--help') process.exit(1);
}

main().catch((e) => { console.error(`binexus: ${e.message}`); process.exit(1); });
