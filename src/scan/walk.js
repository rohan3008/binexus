import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const MARKERS = ['.git', 'package.json', 'pyproject.toml', 'Package.swift'];
const SKIP = new Set(['node_modules']);

export function isProjectDir(entryNames) {
  return MARKERS.some((m) => entryNames.includes(m)) || entryNames.some((n) => n.endsWith('.xcodeproj'));
}

export async function findProjects(root) {
  const found = [];
  async function visit(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    if (isProjectDir(entries.map((e) => e.name))) { found.push(dir); return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIP.has(e.name)) continue;
      await visit(join(dir, e.name));
    }
  }
  await visit(root);
  return found.sort();
}
