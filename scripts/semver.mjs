const SUBJECT = /^(feat|fix|perf|revert|refactor|docs|test|chore|build|ci|style)(?:\([^)]+\))?(!)?:\s+(.+)$/i;
export function classifyCommit(message) {
  const input = String(message || '');
  const subject = input.split(/\r?\n/).find(line => SUBJECT.test(line.trim()));
  if (!subject) return null;
  const [, type, bang] = subject.trim().match(SUBJECT);
  if (bang || /^\s*BREAKING(?: CHANGE|-CHANGE):/im.test(input)) return 'major';
  if (type.toLowerCase() === 'feat') return 'minor';
  if (['fix', 'perf', 'revert'].includes(type.toLowerCase())) return 'patch';
  return null;
}
export function nextSemver(current, messages) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(current)) throw Error('Invalid current SemVer');
  const order = { patch: 1, minor: 2, major: 3 };
  const level = messages.reduce((n, m) => Math.max(n, order[classifyCommit(m)] || 0), 0);
  if (!level) return null;
  const [major, minor, patch] = current.split('.').map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) throw Error('Version too large');
  const parts = level === 3 ? [major + 1, 0, 0] : level === 2 ? [major, minor + 1, 0] : [major, minor, patch + 1];
  if (!parts.every(Number.isSafeInteger)) throw Error('Version overflow');
  return parts.join('.');
}
