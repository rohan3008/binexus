import { rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export async function stripArtifacts(project) {
  const root = resolve(project.path);
  const targets = project.artifacts.map((a) => resolve(root, a.path));
  for (const t of targets) {
    if (!t.startsWith(root + sep)) throw new Error(`refusing to remove ${t}: outside project ${root}`);
  }
  for (const t of targets) await rm(t, { recursive: true, force: true });
  return targets;
}
