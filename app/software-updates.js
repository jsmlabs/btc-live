export const UPDATE_KEY = 'btcLiveSoftwareUpdates';
export const UPDATE_ALARM = 'btcLiveSoftwareUpdateCheck';
export const UPDATE_MESSAGE = 'BTC_LIVE_UPDATE_CHECK';
export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RELEASES_API = 'https://api.github.com/repos/jsmlabs/btc-live/releases';
const RELEASE_BASE = 'https://github.com/jsmlabs/btc-live/releases/tag/';
const RETRY_INTERVAL_MS = 15 * 60 * 1000;
const VALID_VERSION = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export function parseVersion(value) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const match = VALID_VERSION.exec(value);
  if (!match || match.slice(1, 4).some(v => !Number.isSafeInteger(Number(v)))) return null;
  const pre = match[4]?.split('.') ?? [];
  if (pre.some(p => /^\d+$/.test(p) && (p.length > 1 && p[0] === '0' || !Number.isSafeInteger(Number(p))))) return null;
  return { numbers: match.slice(1, 4).map(Number), pre };
}
export function compareVersions(a, b) {
  const left = parseVersion(a), right = parseVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) if (left.numbers[i] !== right.numbers[i]) return Math.sign(left.numbers[i] - right.numbers[i]);
  if (!left.pre.length || !right.pre.length) return Math.sign(right.pre.length - left.pre.length);
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    if (i >= left.pre.length) return -1;
    if (i >= right.pre.length) return 1;
    const x = left.pre[i], y = right.pre[i];
    if (x === y) continue;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return Math.sign(Number(x) - Number(y));
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
export function selectRelease(items, installed, channel = 'stable') {
  if (!Array.isArray(items) || !parseVersion(installed)) return { status: 'UNSUPPORTED' };
  let best = null;
  for (const r of items) {
    if (!r || r.draft !== false || typeof r.prerelease !== 'boolean' || typeof r.tag_name !== 'string') continue;
    if (r.prerelease && channel !== 'preview') continue;
    const parsed = parseVersion(r.tag_name);
    if (!parsed || Boolean(parsed.pre.length) !== r.prerelease) continue;
    // Require an actual published GitHub release, not a tag, draft, or candidate artifact.
    if (typeof r.published_at !== 'string' || !Number.isFinite(Date.parse(r.published_at))) continue;
    const url = RELEASE_BASE + encodeURIComponent(r.tag_name);
    if (!best || compareVersions(r.tag_name, best.version) > 0)
      best = { version: r.tag_name.replace(/^v/, ''), url, prerelease: r.prerelease };
  }
  if (!best) return { status: 'UNSUPPORTED' };
  const newer = compareVersions(best.version, installed);
  return { status: newer > 0 ? (best.prerelease ? 'PREVIEW_AVAILABLE' : 'UPDATE_AVAILABLE') : 'UP_TO_DATE', release: best };
}
export function sanitizeUpdateState(raw, installed) {
  const x = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const channel = x.channel === 'preview' ? 'preview' : 'stable';
  const safeTime = v => Number.isSafeInteger(v) && v > 0 && v <= Date.now() + 60000 ? v : null;
  const safeRetry = v => Number.isSafeInteger(v) && v > 0 && v <= Date.now() + 86400000 ? v : null;
  // Results are meaningful only for the manifest version that was checked.
  const sameInstall = x.checkedInstalled === installed;
  const lastSuccessAt = sameInstall ? safeTime(x.lastSuccessAt) : null;
  let release = null;
  const candidate = x.release;
  if (lastSuccessAt !== null && candidate && typeof candidate === 'object' &&
      typeof candidate.version === 'string' && typeof candidate.prerelease === 'boolean') {
    const parsed = parseVersion(candidate.version);
    const canonical = candidate.version.replace(/^v/, '');
    if (parsed && parsed.pre.length > 0 === candidate.prerelease &&
        (!candidate.prerelease || channel === 'preview') &&
        (candidate.url === RELEASE_BASE + encodeURIComponent(canonical) ||
         candidate.url === RELEASE_BASE + encodeURIComponent('v' + canonical))) {
      release = { version: canonical, url: candidate.url, prerelease: candidate.prerelease };
    }
  }
  let status = 'NOT_CHECKED';
  if (lastSuccessAt !== null) {
    if (release) {
      const newer = compareVersions(release.version, installed);
      status = newer > 0 ? (release.prerelease ? 'PREVIEW_AVAILABLE' : 'UPDATE_AVAILABLE') : 'UP_TO_DATE';
    } else if (x.status === 'UNSUPPORTED') status = 'UNSUPPORTED';
  }
  return {
    enabled: x.enabled !== false, channel, installed, status, release,
    lastAttemptAt: sameInstall ? safeTime(x.lastAttemptAt) : null, lastSuccessAt,
    checkedInstalled: sameInstall ? installed : null,
    error: sameInstall && ['OFFLINE', 'CHECK_FAILED', 'RATE_LIMITED'].includes(x.error) ? x.error : null,
    retryAfter: sameInstall ? safeRetry(x.retryAfter) : null,
    dismissed: typeof x.dismissed === 'string' && parseVersion(x.dismissed) ? x.dismissed : null
  };
}
export function createUpdateController({ api = globalThis.browser ?? globalThis.chrome, fetchFn = globalThis.fetch, now = Date.now,
  isOnline = () => globalThis.navigator?.onLine } = {}) {
  let inFlight = null;
  let operations = Promise.resolve();
  // Serialize checks and settings across concurrent popup/dashboard messages.
  const serialize = task => {
    const result = operations.then(task);
    operations = result.catch(() => {});
    return result;
  };
  const installed = api.runtime.getManifest().version;
  const read = async () => sanitizeUpdateState((await api.storage.local.get(UPDATE_KEY))[UPDATE_KEY], installed);
  const write = async state => { await api.storage.local.set({ [UPDATE_KEY]: state }); return state; };
  async function check({ force = false } = {}) {
    if (inFlight) return inFlight;
    inFlight = serialize(async () => {
      let state = await read();
      const time = now();
      if (!force && (!state.enabled || (state.retryAfter && state.retryAfter > time) ||
        (state.checkedInstalled === installed && state.lastSuccessAt && time - state.lastSuccessAt < UPDATE_INTERVAL_MS))) return state;
      state = await write({ ...state, checkedInstalled: installed, lastAttemptAt: time, error: null, retryAfter: null });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const releases = [];
        let complete = false;
        // GitHub paginates published releases. A partial first page can hide
        // eligible stable versions behind many previews or older releases.
        for (let page = 1; page <= 5; page++) {
          const response = await fetchFn(RELEASES_API + '?per_page=100&page=' + page, {
            headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal,
            redirect: 'error', cache: 'no-store'
          });
          if (response.status === 403 || response.status === 429) {
            const header = response.headers?.get('retry-after');
            const seconds = typeof header === 'string' && /^\d+(?:\.\d+)?$/.test(header.trim())
              ? Number(header.trim()) : NaN;
            const retryMs = Number.isFinite(seconds) ? seconds * 1000
              : typeof header === 'string' ? Date.parse(header) - time : NaN;
            const delayMs = Number.isFinite(retryMs) && retryMs > 0 ? retryMs : 3600000;
            return write({ ...state, error: 'RATE_LIMITED',
              retryAfter: time + Math.min(86400000, Math.max(60000, delayMs)) });
          }
          if (!response.ok) throw Error('GitHub release lookup failed');
          const pageItems = await response.json();
          if (!Array.isArray(pageItems) || pageItems.length > 100)
            throw Error('Invalid GitHub Releases response');
          releases.push(...pageItems);
          if (pageItems.length < 100) { complete = true; break; }
        }
        // Never claim UP_TO_DATE or UNSUPPORTED from a truncated release list.
        if (!complete) throw Error('GitHub release listing exceeded safe page limit');
        const result = selectRelease(releases, installed, state.channel);
        if (result.status === 'UNSUPPORTED') return write({ ...state, status: 'UNSUPPORTED', release: null, checkedInstalled: installed, lastSuccessAt: time });
        return write({ ...state, ...result, checkedInstalled: installed, lastSuccessAt: time });
      } catch {
        return write({ ...state, error: isOnline() === false ? 'OFFLINE' : 'CHECK_FAILED',
          retryAfter: time + RETRY_INTERVAL_MS });
      } finally { clearTimeout(timeout); }
    }).finally(() => { inFlight = null; });
    return inFlight;
  }
  function configure(options) {
    return serialize(async () => {
    const state = await read();
    const changedChannel = (options.channel === 'stable' || options.channel === 'preview') && options.channel !== state.channel;
    const next = await write({ ...state,
      enabled: typeof options.enabled === 'boolean' ? options.enabled : state.enabled,
      channel: options.channel === 'preview' ? 'preview' : options.channel === 'stable' ? 'stable' : state.channel,
      dismissed: typeof options.dismissed === 'string' && parseVersion(options.dismissed) ? options.dismissed : state.dismissed,
      status: changedChannel ? 'NOT_CHECKED' : state.status,
      release: changedChannel ? null : state.release,
      checkedInstalled: changedChannel ? null : state.checkedInstalled,
      lastSuccessAt: changedChannel ? null : state.lastSuccessAt,
      error: changedChannel ? null : state.error,
      retryAfter: changedChannel ? null : state.retryAfter });
    return next;
    });
  }
  return { read, check, configure };
}
