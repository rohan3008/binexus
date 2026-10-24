import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan } from '../skills/binexus/src/apply/validate.js';

const report = { version: 1, projects: [{ path: '/r/a', name: 'a', protected: false, artifacts: [], jobs: [] }] };

test('resolves actions against the report', () => {
  const out = validatePlan({ version: 1, actions: [{ path: '/r/a', action: 'strip' }] }, report);
  assert.equal(out.length, 1);
  assert.equal(out[0].action, 'strip');
  assert.equal(out[0].project.name, 'a');
  assert.equal(out[0].acknowledgeProtected, false);
});

test('rejects bad version, unknown action, unknown path, keep', () => {
  assert.throws(() => validatePlan({ version: 2, actions: [] }, report), /version/);
  assert.throws(() => validatePlan({ version: 1, actions: [{ path: '/r/a', action: 'nuke' }] }, report), /action/);
  assert.throws(() => validatePlan({ version: 1, actions: [{ path: '/r/zzz', action: 'strip' }] }, report), /not in report/);
  assert.throws(() => validatePlan({ version: 1, actions: [{ path: '/r/a', action: 'keep' }] }, report), /action/);
});
