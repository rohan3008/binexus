import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/scan/classify.js';

const now = Date.parse('2026-10-22T00:00:00Z');
const day = 86400000;
const base = { isGit: true, hasUpstream: true, unpushedCommits: 0, uncommittedChanges: false, lastCommit: null, newestSourceMtime: null };
const ago = (d) => new Date(now - d * day).toISOString();

test('class boundaries use the most recent of commit and mtime', () => {
  assert.equal(classify({ ...base, lastCommit: ago(30) }, now).class, 'active');
  assert.equal(classify({ ...base, lastCommit: ago(31) }, now).class, 'idle');
  assert.equal(classify({ ...base, lastCommit: ago(120) }, now).class, 'idle');
  assert.equal(classify({ ...base, lastCommit: ago(121) }, now).class, 'stale');
  assert.equal(classify({ ...base, lastCommit: ago(200), newestSourceMtime: ago(5) }, now).class, 'active');
  assert.equal(classify({ ...base }, now).class, 'stale');
});

test('protected when unpushed, dirty, no upstream, or not git', () => {
  assert.equal(classify(base, now).protected, false);
  assert.equal(classify({ ...base, unpushedCommits: 2 }, now).protected, true);
  assert.equal(classify({ ...base, uncommittedChanges: true }, now).protected, true);
  assert.equal(classify({ ...base, hasUpstream: false, unpushedCommits: null }, now).protected, true);
  assert.equal(classify({ ...base, isGit: false }, now).protected, true);
});
