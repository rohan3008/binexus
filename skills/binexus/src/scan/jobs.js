import { readdir, readFile } from 'node:fs/promises';
import { join, basename, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

function expandHome(token, home) {
  if (token.startsWith('~/') || token === '~') return home + token.slice(1);
  if (token.startsWith('$HOME/')) return home + token.slice(5);
  return token;
}

// Every whitespace-separated token that looks like a path, with ~ and $HOME expanded.
export function pathTokens(text, home) {
  const out = [];
  for (const raw of text.split(/\s+/)) {
    const tok = raw.replace(/^["']|["';&|]+$/g, '');
    if (tok.startsWith('/') || tok.startsWith('~') || tok.startsWith('$HOME/')) out.push(expandHome(tok, home));
  }
  return out;
}

export function parsePlist(xml, plistPath, home) {
  const strings = [...xml.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
  const label = xml.match(/<key>Label<\/key>\s*<string>([^<]*)<\/string>/)?.[1];
  const paths = strings.flatMap((s) => pathTokens(s, home));
  return { kind: 'launchd', id: label || basename(plistPath, '.plist'), plist: plistPath, paths };
}

export function parseCrontab(text, home) {
  return text.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => ({ kind: 'cron', id: line.slice(0, 60), line, paths: pathTokens(line, home) }));
}

export function parsePm2(json) {
  let list = [];
  try { list = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return list.map((p) => ({
    kind: 'pm2', id: p.name, name: p.name,
    paths: [p.pm2_env?.pm_exec_path, p.pm2_env?.pm_cwd].filter(Boolean),
  }));
}

function inside(path, projectPath) {
  return path === projectPath || path.startsWith(projectPath + sep);
}

export function attachJobs(projects, jobs) {
  const unmatched = [];
  for (const job of jobs) {
    const owner = projects.find((p) => job.paths.some((path) => inside(path, p.path)));
    if (owner) owner.jobs.push(job); else unmatched.push(job);
  }
  return unmatched;
}

// Live collection. Each source fails soft.
export async function collectJobs({ home }) {
  const jobs = [];
  const agentsDir = join(home, 'Library', 'LaunchAgents');
  try {
    for (const name of await readdir(agentsDir)) {
      if (!name.endsWith('.plist')) continue;
      const p = join(agentsDir, name);
      try { jobs.push(parsePlist(await readFile(p, 'utf8'), p, home)); } catch {}
    }
  } catch {}
  try { jobs.push(...parseCrontab((await run('crontab', ['-l'])).stdout, home)); } catch {}
  try { jobs.push(...parsePm2((await run('pm2', ['jlist'])).stdout)); } catch {}
  return jobs;
}
