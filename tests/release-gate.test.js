import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_RELEASE_GATES, validateReleaseAcceptance } from '../scripts/release-gate.mjs';

const sha = 'a'.repeat(40);
function record() {
  return {
    schema_version: 1, manifest_version: '1.24.2', commit: sha,
    decision: 'approved', approved_by: 'Release reviewer', approved_at: '2026-10-15T10:00:00Z',
    gates: REQUIRED_RELEASE_GATES.map(id => ({ id, status: 'passed', evidence: ['https://github.com/jsmlabs/btc-live/actions/runs/123'] }))
  };
}
const check = r => validateReleaseAcceptance(r, { commit: sha, version: '1.24.2' });
test('release gate allows a complete exact-SHA acceptance record', () => {
  assert.deepEqual(check(record()), []);
});
test('rejects pending, wrong commit and missing approval', () => {
  const r = record(); r.commit = 'b'.repeat(40); r.decision = 'pending'; r.approved_at = null;
  assert.ok(check(r).length >= 3);
});
test('rejects missing, duplicate, failed or unsupported gates', () => {
  const missing = record(); missing.gates.pop();
  assert.ok(check(missing).length);
  const duplicate = record(); duplicate.gates[0] = duplicate.gates[1];
  assert.ok(check(duplicate).length);
  const failing = record(); failing.gates[0].status = 'pending';
  assert.ok(check(failing).some(x => x.includes('Gate not passed')));
  const noEvidence = record(); noEvidence.gates[0].evidence = [];
  assert.ok(check(noEvidence).some(x => x.includes('linked evidence')));
});
test('rejects invalid evidence and mismatched manifest version', () => {
  const r = record(); r.manifest_version = '2.0.0'; r.gates[0].evidence = ['file:///tmp/fake'];
  assert.ok(check(r).length >= 2);
});
