import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_RELEASE_GATES = Object.freeze([
  'chromium-ui',
  'live-binance-feeds',
  'depth-recovery',
  'mv3-alert-lifecycle',
  'recording-replay-load',
  'existing-install-migration',
  'store-assets-privacy'
]);

export function validateReleaseAcceptance(record, { commit, version }) {
  const failures = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['Missing release acceptance record'];
  if (record.schema_version !== 1) failures.push('Unexpected acceptance schema');
  if (record.manifest_version !== version) failures.push('Acceptance manifest version differs from the source');
  if (!/^[0-9a-f]{40}$/.test(commit || '') || record.commit !== commit) failures.push('Acceptance must match the exact Git commit');
  if (record.decision !== 'approved') failures.push('Release has not been explicitly approved');
  if (typeof record.approved_by !== 'string' || !record.approved_by.trim()) failures.push('Release approver is missing');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(record.approved_at || '') ||
      !Number.isFinite(Date.parse(record.approved_at))) failures.push('Release approval timestamp is missing or malformed');
  if (!Array.isArray(record.gates) || record.gates.length !== REQUIRED_RELEASE_GATES.length) {
    failures.push('Release gate inventory differs from the required list');
    return failures;
  }
  const ids = record.gates.map(g => g?.id);
  if (new Set(ids).size !== REQUIRED_RELEASE_GATES.length ||
      REQUIRED_RELEASE_GATES.some(id => !ids.includes(id))) failures.push('Missing, duplicated or unexpected release gate');
  for (const gate of record.gates) {
    if (!REQUIRED_RELEASE_GATES.includes(gate?.id)) continue;
    if (gate.status !== 'passed') failures.push('Gate not passed: ' + gate.id);
    if (!Array.isArray(gate.evidence) || !gate.evidence.length ||
        gate.evidence.some(ref => typeof ref !== 'string' || !/^https:\/\//.test(ref))) {
      failures.push('Gate requires linked evidence: ' + gate.id);
    }
  }
  return failures;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== commit) throw Error('GitHub SHA does not match checked-out source');
    const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const record = JSON.parse(readFileSync(path.join(root, 'docs/release-acceptance.json'), 'utf8'));
    const failures = validateReleaseAcceptance(record, { commit, version: manifest.version });
    if (failures.length) {
      console.error('Stable release blocked:\n- ' + failures.join('\n- '));
      process.exitCode = 1;
    } else {
      console.log('Release acceptance record matches exact commit and required evidence references.');
      console.log('Human review of underlying evidence is still required before publication.');
    }
  } catch (error) {
    console.error('Stable release blocked: ' + error.message);
    process.exitCode = 1;
  }
}
