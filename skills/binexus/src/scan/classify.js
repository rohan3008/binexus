const DAY = 86400000;
export const IDLE_DAYS = 30;
export const STALE_DAYS = 120;

export function classify(s, now = Date.now()) {
  const times = [s.lastCommit, s.newestSourceMtime].filter(Boolean).map((t) => Date.parse(t));
  const last = times.length ? Math.max(...times) : 0;
  const days = (now - last) / DAY;
  const cls = days <= IDLE_DAYS ? 'active' : days <= STALE_DAYS ? 'idle' : 'stale';
  const prot = !s.isGit || !s.hasUpstream || (s.unpushedCommits ?? 0) > 0 || s.uncommittedChanges;
  return { class: cls, protected: prot };
}
