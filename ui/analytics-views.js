// Presentation-only analytics navigation: does not change feeds, data or storage.
export const ANALYTICS_VIEWS = Object.freeze(['all', 'liquidity', 'orderflow', 'behavior']);
const descriptions = Object.freeze({
  all: ['Market intelligence', 'Visible liquidity and executed trades are separate observations. Values are only shown when the relevant feeds are valid.'],
  liquidity: ['Visible liquidity', 'Displayed resting orders and their observed history. Live values require synchronized depth.'],
  orderflow: ['Executed order flow', 'Aggressive executions, rolling delta and connection-relative CVD. Incomplete trade windows are unavailable.'],
  behavior: ['Liquidity behavior', 'Changes in displayed resting orders. Measurements require consecutive valid depth observations.']
});
export function bindAnalyticsViews(doc, { onChange = () => {} } = {}) {
  const nav = doc.querySelector('.analytics-overview');
  const title = doc.getElementById('analyticsViewTitle');
  const description = doc.getElementById('analyticsViewDescription');
  const controls = [...doc.querySelectorAll('[data-analytics-view]')];
  if (!nav || controls.length !== ANALYTICS_VIEWS.length) throw new Error('Analytics navigation controls missing');
  function choose(view) {
    if (!ANALYTICS_VIEWS.includes(view)) return false;
    nav.dataset.analyticsActiveView = view;
    for (const control of controls) {
      const selected = control.dataset.analyticsView === view;
      control.setAttribute('aria-pressed', String(selected));
      control.tabIndex = selected ? 0 : -1;
    }
    if (title) title.textContent = descriptions[view][0];
    if (description) description.textContent = descriptions[view][1];
    onChange(view);
    return true;
  }
  function onKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const index = controls.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length;
    choose(controls[next].dataset.analyticsView);
    controls[next].focus();
  }
  const listeners = controls.map(control => {
    const handler = () => choose(control.dataset.analyticsView);
    control.addEventListener('click', handler);
    return [control, handler];
  });
  nav.addEventListener('keydown', onKey);
  choose('all');
  return { choose, dispose() { for (const [control, handler] of listeners) control.removeEventListener('click', handler); nav.removeEventListener('keydown', onKey); delete nav.dataset.analyticsActiveView; } };
}
