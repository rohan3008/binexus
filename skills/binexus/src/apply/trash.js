import { mkdir, rename, readdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';

async function exists(p) { try { await access(p); return true; } catch { return false; } }

export async function deleteProject(project, { trashDir, date }) {
  await mkdir(trashDir, { recursive: true });
  let name = `${date}-${project.name}`;
  for (let n = 2; await exists(join(trashDir, name)); n++) name = `${date}-${project.name}-${n}`;
  const dest = join(trashDir, name);
  await rename(project.path, dest);
  await writeFile(join(trashDir, `${name}.manifest.json`), JSON.stringify({ originalPath: project.path, deletedAt: date, project }, null, 2));
  return dest;
}

export async function listTrash(trashDir) {
  let names = [];
  try { names = await readdir(trashDir); } catch { return []; }
  const out = [];
  for (const n of names.filter((n) => n.endsWith('.manifest.json')).sort()) {
    const m = JSON.parse(await readFile(join(trashDir, n), 'utf8'));
    out.push({ name: n.replace(/\.manifest\.json$/, ''), originalPath: m.originalPath, deletedAt: m.deletedAt });
  }
  return out;
}

export async function restoreProject(name, { trashDir }) {
  const manifestPath = join(trashDir, `${name}.manifest.json`);
  const m = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (await exists(m.originalPath)) throw new Error(`${m.originalPath} already exists; move it aside first`);
  await mkdir(join(m.originalPath, '..'), { recursive: true });
  await rename(join(trashDir, name), m.originalPath);
  await rm(manifestPath);
  return m.originalPath;
}
