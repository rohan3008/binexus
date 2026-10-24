import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlist, parseCrontab, parsePm2, attachJobs } from '../skills/binexus/src/scan/jobs.js';

const HOME = '/Users/me';

test('parsePlist extracts label and absolute paths from any string', () => {
  const xml = `<?xml version="1.0"?><plist><dict>
    <key>Label</key><string>com.edgefinder.daily</string>
    <key>ProgramArguments</key><array>
      <string>/bin/zsh</string><string>-lc</string>
      <string>cd ~/Documents/edgefinder && ./run.sh</string></array>
    <key>WorkingDirectory</key><string>$HOME/Documents/edgefinder</string>
  </dict></plist>`;
  const job = parsePlist(xml, '/Users/me/Library/LaunchAgents/x.plist', HOME);
  assert.equal(job.kind, 'launchd');
  assert.equal(job.id, 'com.edgefinder.daily');
  assert.equal(job.plist, '/Users/me/Library/LaunchAgents/x.plist');
  assert.deepEqual(job.paths, ['/bin/zsh', '/Users/me/Documents/edgefinder', '/Users/me/Documents/edgefinder']);
});

test('parsePlist falls back to file name when Label missing', () => {
  const job = parsePlist('<plist><dict></dict></plist>', '/x/y/com.foo.plist', HOME);
  assert.equal(job.id, 'com.foo');
  assert.deepEqual(job.paths, []);
});

test('parseCrontab skips comments and blanks', () => {
  const text = '# comment\n\n0 7 * * * /usr/bin/python3 ~/Documents/quiver/run.py\n*/5 * * * * echo hi\n';
  const jobs = parseCrontab(text, HOME);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].kind, 'cron');
  assert.equal(jobs[0].line, '0 7 * * * /usr/bin/python3 ~/Documents/quiver/run.py');
  assert.deepEqual(jobs[0].paths, ['/usr/bin/python3', '/Users/me/Documents/quiver/run.py']);
  assert.deepEqual(jobs[1].paths, []);
});

test('parsePm2 reads exec path and cwd', () => {
  const json = JSON.stringify([{ name: 'api', pm2_env: { pm_exec_path: '/Users/me/Documents/api/server.js', pm_cwd: '/Users/me/Documents/api' } }]);
  const [job] = parsePm2(json);
  assert.equal(job.kind, 'pm2');
  assert.equal(job.id, 'api');
  assert.deepEqual(job.paths, ['/Users/me/Documents/api/server.js', '/Users/me/Documents/api']);
});

test('attachJobs matches by path prefix and returns the rest', () => {
  const projects = [{ path: '/Users/me/Documents/edgefinder', jobs: [] }, { path: '/Users/me/Documents/edge', jobs: [] }];
  const jobs = [
    { kind: 'launchd', id: 'a', paths: ['/Users/me/Documents/edgefinder/run.sh'] },
    { kind: 'cron', id: 'b', paths: ['/opt/elsewhere'] },
  ];
  const unmatched = attachJobs(projects, jobs);
  assert.deepEqual(projects[0].jobs.map((j) => j.id), ['a']);
  assert.deepEqual(projects[1].jobs, []);
  assert.deepEqual(unmatched.map((j) => j.id), ['b']);
});
