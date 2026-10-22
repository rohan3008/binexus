import { readdir, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';

export const ARTIFACT_NAMES = new Set([
  'node_modules', '.venv', 'venv', '.build', 'build', 'dist', 'DerivedData',
  '.next', '.turbo', '.cache', '__pycache__', '.pytest_cache',
]);

function isArtifact(name, siblingNames) {
  if (ARTIFACT_NAMES.has(name)) return true;
  return name === 'target' && siblingNames.includes('Cargo.toml');
}

export async function dirBytes(dir) {
  let total = 0;
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) total += await dirBytes(p);
    else { try { total += (await lstat(p)).size; } catch {} }
  }
  return total;
}

// One walk of a project: total size, regenerable artifact dirs (not
// descended into), and the newest mtime of any non-artifact, non-.git file.
export async function inspectTree(root) {
  const artifacts = [];
  let totalBytes = 0;
  let artifactBytes = 0;
  let newest = 0;

  async function visit(dir) {
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    const names = entries.map((e) => e.name);
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (isArtifact(e.name, names)) {
          const bytes = await dirBytes(p);
          artifacts.push({ path: relative(root, p), bytes });
          artifactBytes += bytes;
          totalBytes += bytes;
        } else if (e.name === '.git') {
          totalBytes += await dirBytes(p);
        } else {
          await visit(p);
        }
      } else {
        try {
          const st = await lstat(p);
          totalBytes += st.size;
          if (st.mtimeMs > newest) newest = st.mtimeMs;
        } catch {}
      }
    }
  }

  await visit(root);
  return {
    totalBytes,
    artifactBytes,
    artifacts,
    newestSourceMtime: newest ? new Date(newest).toISOString() : null,
  };
}
