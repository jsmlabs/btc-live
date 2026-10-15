import { allowedWorkspaceViews, initialWorkspaceView, sanitizeWorkspace, WORKSPACE_VIEWS } from '../storage/workspace-preferences.js';

const descriptions = Object.freeze({
  live: 'Live price and market overview · Futures data independent of replay.',
  analytics: 'Visible resting liquidity and executed Futures trades · not trading signals.',
  replay: 'Sample and Event Replay · offline observations never trigger live alerts.',
  alerts: 'Local price targets, notification delivery preferences and alert history.',
  diagnostics: 'Connection states and recovery counters · validate live feeds before release.',
  settings: 'Local display preferences and onboarding · no account or telemetry.'
});

// Pure visibility controller. It does not start/stop feeds, change alerts or manipulate recordings.
export function createWorkspaceController({ root = document, onNavigate = () => {}, onPreferenceChange = () => {} } = {}) {
  const nav = root.getElementById('dashboardWorkspaceNav');
  const presetSelect = root.getElementById('dashboardWorkspacePreset');
  const landingSelect = root.getElementById('dashboardWorkspaceLanding');
  const context = root.getElementById('dashboardWorkspaceContext');
  const links = [...nav.querySelectorAll('[data-workspace-target]')];
  const panels = [...root.querySelectorAll('[data-workspace-panel]')];
  let preferences = sanitizeWorkspace(null);
  let active = initialWorkspaceView(preferences);
  let interacted = false;

  function render() {
    const allowed = allowedWorkspaceViews(preferences.preset);
    if (!allowed.includes(active)) active = 'live';
    presetSelect.value = preferences.preset;
    landingSelect.value = preferences.landingView;
    for (const link of links) {
      const view = link.dataset.workspaceTarget;
      link.hidden = !allowed.includes(view);
      link.setAttribute('aria-pressed', String(view === active));
      link.tabIndex = view === active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.workspacePanel !== active;
    root.getElementById('dashboardShell')?.setAttribute('data-workspace-ready', 'true');
    context.textContent = descriptions[active];
    onNavigate(active);
  }
  function persist() { onPreferenceChange({ ...preferences }); }
  function navigate(view, { user = false } = {}) {
    if (!WORKSPACE_VIEWS.includes(view) || !allowedWorkspaceViews(preferences.preset).includes(view)) return false;
    if (user) interacted = true;
    if (active === view) return true;
    active = view;
    render();
    return true;
  }
  function setPreferences(value, { user = false } = {}) {
    if (user) interacted = true;
    preferences = sanitizeWorkspace(value);
    active = initialWorkspaceView(preferences);
    render();
    if (user) persist();
  }
  function restore(value) { if (!interacted) setPreferences(value); }
  function onNavClick(event) {
    const link = event.target.closest('[data-workspace-target]');
    if (link) navigate(link.dataset.workspaceTarget, { user: true });
  }
  function onNavKey(event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const available = links.filter(link => !link.hidden);
    const index = available.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const dest = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
    navigate(available[dest].dataset.workspaceTarget, { user: true });
    available[dest].focus();
  }
  const onPreset = () => setPreferences({ ...preferences, preset: presetSelect.value }, { user: true });
  const onLanding = () => {
    interacted = true;
    preferences = sanitizeWorkspace({ ...preferences, landingView: landingSelect.value });
    persist();
    landingSelect.value = preferences.landingView;
  };
  nav.addEventListener('click', onNavClick);
  nav.addEventListener('keydown', onNavKey);
  presetSelect.addEventListener('change', onPreset);
  landingSelect.addEventListener('change', onLanding);
  render();
  return {
    navigate, restore, sync(value) {
      const next = sanitizeWorkspace(value);
      if (next.preset !== preferences.preset || next.landingView !== preferences.landingView) setPreferences(next);
    },
    active: () => active, preferences: () => ({ ...preferences }),
    dispose() { nav.removeEventListener('click', onNavClick); nav.removeEventListener('keydown', onNavKey); presetSelect.removeEventListener('change', onPreset); landingSelect.removeEventListener('change', onLanding); }
  };
}

// The Replay Studio uses one visible mode, retaining two independent engines/formats.
export function createReplayModeController({ root = document, onChange = () => {} } = {}) {
  const buttons = [root.getElementById('dashboardReplayModeSamples'), root.getElementById('dashboardReplayModeEvents')];
  const panels = [root.getElementById('dashboardReplayPanel'), root.getElementById('dashboardEventPanel')];
  let active = 'events';
  function select(value) {
    if (!['samples','events'].includes(value)) return;
    active = value;
    buttons.forEach((button, index) => { button.setAttribute('aria-pressed', String((index === 0 ? 'samples' : 'events') === active)); });
    panels.forEach((panel,index) => { panel.hidden = (index === 0 ? 'samples' : 'events') !== active; });
    onChange(active);
  }
  const handlers = buttons.map((button,index) => {
    const handler = () => select(index === 0 ? 'samples' : 'events');
    button.addEventListener('click', handler); return handler;
  });
  select('events');
  return { select, active: () => active, dispose() { buttons.forEach((button,i) => button.removeEventListener('click', handlers[i])); } };
}
