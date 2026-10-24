import { mkdir, rename } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';

// Run a command, optionally feeding stdin. Resolves stdout.
export function sh(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, (err, stdout) => (err ? reject(err) : resolve(stdout)));
    if (input !== undefined) child.stdin.end(input);
  });
}

export function commentCronLine(text, line, date) {
  return text.split('\n').map((l) => (l === line ? `# binexus paused ${date}: ${l}` : l)).join('\n');
}

export async function pauseJob(job, deps) {
  const run = deps.sh ?? sh;
  if (job.kind === 'launchd') {
    // bootout fails if the agent is already unloaded; moving the plist is what
    // stops it coming back at next login, so that is the step that must succeed.
    try { await run('launchctl', ['bootout', `gui/${deps.uid}/${job.id}`]); } catch {}
    await mkdir(deps.pausedDir, { recursive: true });
    await rename(job.plist, join(deps.pausedDir, basename(job.plist)));
    return `unloaded ${job.id}; plist moved to ${deps.pausedDir}`;
  }
  if (job.kind === 'cron') {
    const current = await run('crontab', ['-l']);
    await run('crontab', ['-'], commentCronLine(current, job.line, deps.date));
    return `commented out cron line: ${job.line}`;
  }
  if (job.kind === 'pm2') {
    await run('pm2', ['stop', job.name]);
    return `pm2 stop ${job.name}`;
  }
  throw new Error(`unknown job kind ${job.kind}`);
}
