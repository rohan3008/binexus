import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { findProjects } from './walk.js';
import { gitSignals } from './git.js';
import { inspectTree } from './artifacts.js';
import { collectJobs, attachJobs } from './jobs.js';
import { classify } from './classify.js';

// deps.jobs: pre-collected jobs (tests). deps.now: clock. deps.onProgress(path).
export async function scan(rootArg, deps = {}) {
  const root = resolve(rootArg);
  const now = deps.now ?? Date.now();
  const paths = await findProjects(root);
  const projects = [];
  for (const path of paths) {
    deps.onProgress?.(path);
    const g = await gitSignals(path);
    const t = await inspectTree(path);
    const signals = { ...g, newestSourceMtime: t.newestSourceMtime };
    const { class: cls, protected: prot } = classify(signals, now);
    projects.push({
      path, name: basename(path), class: cls, protected: prot,
      lastCommit: g.lastCommit, newestSourceMtime: t.newestSourceMtime,
      unpushedCommits: g.unpushedCommits, uncommittedChanges: g.uncommittedChanges,
      isGit: g.isGit, hasUpstream: g.hasUpstream,
      totalBytes: t.totalBytes, artifactBytes: t.artifactBytes, artifacts: t.artifacts,
      jobs: [],
    });
  }
  const jobs = deps.jobs ?? (await collectJobs({ home: deps.home ?? homedir() }));
  const unmatchedJobs = attachJobs(projects, jobs);
  return { version: 1, root, scannedAt: new Date(now).toISOString(), projects, unmatchedJobs };
}
