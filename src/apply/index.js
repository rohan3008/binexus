import { join } from 'node:path';
import { homedir } from 'node:os';
import { validatePlan } from './validate.js';
import { pauseJob, sh as realSh } from './pause.js';
import { stripArtifacts } from './strip.js';
import { deleteProject } from './trash.js';
import * as realPrompt from '../prompt.js';
import { gitSignals } from '../scan/git.js';
import { classify } from '../scan/classify.js';

export function binexusHome(home) {
  return process.env.BINEXUS_HOME || join(home, '.binexus');
}

async function defaultRecheck(project) {
  const g = await gitSignals(project.path);
  return classify({ ...g, newestSourceMtime: project.newestSourceMtime });
}

const mb = (b) => `${(b / 1048576).toFixed(0)} MB`;

function describe({ action, project }) {
  if (action === 'pause') return `PAUSE ${project.jobs.map((j) => `${j.kind}:${j.id}`).join(', ') || '(no jobs)'} for ${project.name}`;
  if (action === 'strip') return `STRIP ${project.artifacts.map((a) => a.path).join(', ') || '(nothing)'} from ${project.name} (${mb(project.artifactBytes ?? 0)})`;
  return `DELETE ${project.path} -> trash${project.jobs.length ? ` (pausing ${project.jobs.length} job(s) first)` : ''}`;
}

export async function apply(plan, report, deps = {}) {
  const home = deps.home ?? homedir();
  const base = binexusHome(home);
  const d = {
    sh: deps.sh ?? realSh, prompt: deps.prompt ?? realPrompt, log: deps.log ?? console.log,
    date: deps.date ?? new Date().toISOString().slice(0, 10), uid: deps.uid ?? process.getuid?.(),
    recheck: deps.recheck ?? defaultRecheck, yesToStrip: deps.yesToStrip ?? false,
    pausedDir: join(base, 'paused'), trashDir: join(base, 'trash'),
  };
  const results = [];

  for (const entry of validatePlan(plan, report)) {
    const { action, project } = entry;
    const line = describe(entry);
    const push = (status, note) => {
      results.push({ path: project.path, action, status, ...(note ? { note } : {}) });
      d.log(`${status.toUpperCase()}: ${line}${note ? ` -- ${note}` : ''}`);
    };

    if (action === 'delete') {
      const now = await d.recheck(project);
      if (now.protected && !entry.acknowledgeProtected) {
        push('refused', 'project has unpushed or uncommitted work (or no git/upstream); set acknowledgeProtected: true in the plan to override');
        continue;
      }
      if (!(await d.prompt.confirm(line))) { push('skipped'); continue; }
      if (now.protected && !(await d.prompt.typed(`${project.name} may contain work that exists nowhere else.`, project.name))) {
        push('skipped', 'name did not match');
        continue;
      }
      try {
        for (const job of project.jobs) await pauseJob(job, d);
        const dest = await deleteProject(project, d);
        push('done', `moved to ${dest}`);
      } catch (e) { push('error', e.message); }
      continue;
    }

    if (action === 'strip' && project.artifacts.length === 0) { push('skipped', 'no artifacts'); continue; }
    if (action === 'pause' && project.jobs.length === 0) { push('skipped', 'no jobs'); continue; }
    const auto = action === 'strip' && d.yesToStrip;
    if (!auto && !(await d.prompt.confirm(line))) { push('skipped'); continue; }
    try {
      if (action === 'strip') await stripArtifacts(project);
      else for (const job of project.jobs) await pauseJob(job, d);
      push('done');
    } catch (e) { push('error', e.message); }
  }
  return results;
}
