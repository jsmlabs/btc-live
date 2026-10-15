import { UPDATE_KEY, UPDATE_MESSAGE } from '../app/software-updates.js';

export function mountSoftwareUpdates({ container, compact = false, api = globalThis.browser ?? globalThis.chrome }) {
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
  controls.append(button, link);
  root.append(title, status, detail, toggleLabel, channelLabel, controls);
  container.append(root);
  let disposed = false;
  const send = async action => {
    const reply = await api.runtime.sendMessage({ type: UPDATE_MESSAGE, ...action });
    if (!reply?.ok) throw Error('Version check unavailable');
    return reply.state;
  };
  const formatTime = value => value ? new Date(value).toLocaleString() : 'Never';
  function render(state) {
    if (disposed || !state) return;
    toggle.checked = state.enabled;
    channel.value = state.channel;
    const descriptions = {
      NOT_CHECKED: 'Not checked yet',
      UP_TO_DATE: 'No newer release found',
      UPDATE_AVAILABLE: 'A newer stable release is available',
      PREVIEW_AVAILABLE: 'A newer preview release is available',
      UNSUPPORTED: 'No eligible published release is available'
    };
    status.textContent = state.error === 'RATE_LIMITED' ? 'GitHub rate limit reached'
      : state.error ? 'Unable to check for updates' : descriptions[state.status] ?? 'Not checked yet';
    detail.textContent = 'Installed: ' + state.installed + ' · Available: ' + (state.release?.version ?? 'None') +
      ' · Last checked: ' + formatTime(state.lastSuccessAt) + (state.error ? ' · Previous result may be outdated' : '');
    const eligible = state.release && ['UPDATE_AVAILABLE', 'PREVIEW_AVAILABLE'].includes(state.status);
    link.hidden = !eligible;
    if (eligible) link.href = state.release.url;
    else link.removeAttribute('href');
  }
  async function execute(action) {
    button.disabled = true;
    status.textContent = 'Checking update status…';
    try { render(await send(action)); }
    catch { status.textContent = 'Update service unavailable'; }
    finally { button.disabled = false; }
  }
  button.addEventListener('click', () => void execute({ action: 'check', force: true }));
  toggle.addEventListener('change', () => void execute({ action: 'configure', enabled: toggle.checked }));
  channel.addEventListener('change', () => void execute({ action: 'configure', channel: channel.value })
    .then(() => execute({ action: 'check', force: true })));
  const storageListener = (changes, area) => {
    if (area === 'local' && changes?.[UPDATE_KEY]) render(changes[UPDATE_KEY].newValue);
  };
  api.storage?.onChanged?.addListener(storageListener);
  void execute({ action: 'check', force: false });
  return () => { disposed = true; api.storage?.onChanged?.removeListener(storageListener); root.remove(); };
}
