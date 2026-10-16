import { UPDATE_KEY, UPDATE_MESSAGE, sanitizeUpdateState } from '../app/software-updates.js';

export function mountSoftwareUpdates({ container, compact = false, indicator = null, api = globalThis.browser ?? globalThis.chrome }) {
  if (!container || !api?.runtime?.sendMessage) return () => {};
  const root = document.createElement('section');
  root.className = 'software-updates';
  root.setAttribute('aria-label', 'Software updates');
  const title = document.createElement('h2');
  title.textContent = 'Software Updates';
  title.className = 'settings-group-title';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const detail = document.createElement('p');
  const controls = document.createElement('div');
  controls.className = 'settings-actions-inline';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Check for Updates';
  button.className = compact ? 'secondary-button' : 'button tertiary';
  const link = document.createElement('a');
  link.textContent = 'View Release Notes';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.hidden = true;
  const downloadLink = document.createElement('a');
  downloadLink.textContent = 'Download Extension ZIP';
  downloadLink.target = '_blank';
  downloadLink.rel = 'noopener noreferrer';
  downloadLink.hidden = true;
  const checksumLink = document.createElement('a');
  checksumLink.textContent = 'SHA-256 Checksums';
  checksumLink.target = '_blank';
  checksumLink.rel = 'noopener noreferrer';
  checksumLink.hidden = true;
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'setting-row';
  toggleLabel.append('Automatic daily checks');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggleLabel.append(toggle);
  const channelLabel = document.createElement('label');
  channelLabel.className = 'setting-row';
  channelLabel.append('Release channel');
  const channel = document.createElement('select');
  for (const value of ['stable', 'preview']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value === 'stable' ? 'Stable' : 'Preview';
    channel.append(option);
  }
  channelLabel.append(channel);
  controls.append(button, link, downloadLink, checksumLink);
  const note = document.createElement('p');
  note.className = 'settings-scope-note';
  note.textContent = 'Development builds in the repository are not published updates. To refresh an unpacked installation, update the local source and reload it in chrome://extensions. This checker does not install software.';
  note.hidden = true;
  const sourceLink = document.createElement('a');
  sourceLink.textContent = 'Open official source and upgrade guide';
  sourceLink.href = 'https://github.com/jsmlabs/btc-live#get-started';
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  sourceLink.hidden = true;
  controls.append(sourceLink);
  root.append(title, status, detail, note, toggleLabel, channelLabel, controls);
  container.append(root);
  let disposed = false;
  let busy = false;
  let checking = false;
  let latestState = null;
  const installed = api.runtime.getManifest().version;
  const send = async action => {
    const reply = await api.runtime.sendMessage({ type: UPDATE_MESSAGE, ...action });
    if (!reply?.ok) throw Error('Version check unavailable');
    return reply.state;
  };
  const formatTime = value => value ? new Date(value).toLocaleString() : 'Never';
  function render(raw) {
    if (disposed || !raw) return;
    // Storage changes are untrusted; never use an unchecked cached release URL.
    const state = sanitizeUpdateState(raw, installed);
    latestState = state;
    toggle.checked = state.enabled;
    channel.value = state.channel;
    const descriptions = {
      NOT_CHECKED: 'Not checked yet',
      UP_TO_DATE: 'Up to date with the latest eligible published release',
      INSTALLED_AHEAD: 'Installed version is newer than the latest eligible published release',
      UPDATE_AVAILABLE: 'A newer stable release is available',
      PREVIEW_AVAILABLE: 'A newer preview release is available',
      EXPERIMENTAL_AVAILABLE: 'Experimental download available (same installed version; not an upgrade)',
      UNSUPPORTED: 'No eligible published release is available',
      DEVELOPMENT_AVAILABLE: 'Newer development source available (not a published release)'
    };
    status.textContent = checking ? 'Checking for updates…'
      : state.error === 'RATE_LIMITED' ? 'GitHub rate limit reached'
      : state.error === 'OFFLINE' ? 'Network unavailable'
      : state.error ? 'Unable to check for updates'
      : descriptions[state.status] ?? 'Not checked yet';
    detail.textContent = 'Installed: ' + state.installed + ' · Available: ' + (state.release?.version ?? 'None') +
      (state.developmentVersion ? ' · Development source: ' + state.developmentVersion : '') +
      ' · Last successful check: ' + formatTime(state.lastSuccessAt) +
      ' · Last attempt: ' + formatTime(state.lastAttemptAt) +
      (state.error ? ' · Previous result may be outdated' : '');
    note.hidden = !['UNSUPPORTED', 'EXPERIMENTAL_AVAILABLE', 'DEVELOPMENT_AVAILABLE'].includes(state.status);
    note.textContent = state.status === 'DEVELOPMENT_AVAILABLE'
      ? 'Newer source is available on GitHub, but no eligible GitHub Release is published. Unpacked installations need a manual source refresh and extension reload; browser-store installations are updated by the store. This is not an automatic update.'
      : state.status === 'EXPERIMENTAL_AVAILABLE'
      ? 'Untested experimental download. The packaged manifest version is unchanged. GitHub does not install this extension: inspect the release, verify its checksum, and manually load unpacked in a disposable browser profile.'
      : 'Development builds in the repository are not published updates. To refresh an unpacked installation, update the local source and reload it in chrome://extensions. This checker does not install software.';
    sourceLink.hidden = !['UNSUPPORTED', 'DEVELOPMENT_AVAILABLE'].includes(state.status);
    const eligible = state.release && ['UPDATE_AVAILABLE', 'PREVIEW_AVAILABLE', 'EXPERIMENTAL_AVAILABLE'].includes(state.status);
    link.textContent = state.status === 'EXPERIMENTAL_AVAILABLE' ? 'View Experimental Download' : 'View Release Notes';
    link.hidden = !eligible;
    if (eligible) link.href = state.release.url;
    else link.removeAttribute('href');
    downloadLink.hidden = !eligible || !state.release.downloadUrl;
    if (!downloadLink.hidden) downloadLink.href = state.release.downloadUrl;
    else downloadLink.removeAttribute('href');
    checksumLink.hidden = !eligible || !state.release.checksumUrl || !state.release.downloadUrl;
    if (!checksumLink.hidden) checksumLink.href = state.release.checksumUrl;
    else checksumLink.removeAttribute('href');
    if (indicator) {
      indicator.hidden = !eligible || state.dismissed === state.release.version;
      indicator.textContent = eligible ? (state.status === 'EXPERIMENTAL_AVAILABLE'
        ? 'BTC Live experimental download · Not an upgrade'
        : 'BTC Live ' + state.release.version + ' available · View in Settings') : '';
    }
  }
  const setBusy = value => {
    busy = value;
    button.disabled = value;
    toggle.disabled = value;
    channel.disabled = value;
  };
  async function execute(actions, checkRequested = false) {
    if (disposed || busy) return;
    setBusy(true);
    checking = checkRequested;
    if (checking) status.textContent = 'Checking for updates…';
    let failed = false;
    try {
      for (const action of actions) render(await send(action));
    } catch {
      failed = true;
      if (!disposed) status.textContent = 'Update service unavailable';
    } finally {
      checking = false;
      if (!disposed) {
        setBusy(false);
        if (!failed && latestState) render(latestState);
      }
    }
  }
  button.addEventListener('click', () => void execute([{ action: 'check', force: true }], true));
  toggle.addEventListener('change', () => void execute([{ action: 'configure', enabled: toggle.checked }]));
  channel.addEventListener('change', () => void execute([
    { action: 'configure', channel: channel.value },
    { action: 'check', force: true }
  ], true));
  const storageListener = (changes, area) => {
    if (area === 'local' && changes?.[UPDATE_KEY]) render(changes[UPDATE_KEY].newValue);
  };
  api.storage?.onChanged?.addListener(storageListener);
  void execute([{ action: 'check', force: false }], true);
  return () => {
    disposed = true;
    api.storage?.onChanged?.removeListener(storageListener);
    root.remove();
    if (indicator) indicator.hidden = true;
  };
}
