// Presentation-only analytics navigation: does not change feeds, data or storage.
export const ANALYTICS_VIEWS = Object.freeze(['all', 'liquidity', 'orderflow', 'behavior']);
export function bindAnalyticsViews(doc) {
  const nav = doc.querySelector('.analytics-overview');
  const controls = [...doc.querySelectorAll('[data-analytics-view]')];
  if (!nav || controls.length !== ANALYTICS_VIEWS.length) throw new Error('Analytics navigation controls missing');
  function choose(view) {
    if (!ANALYTICS_VIEWS.includes(view)) return false;
    nav.dataset.analyticsActiveView = view;
    for (const control of controls) control.setAttribute('aria-pressed', String(control.dataset.analyticsView === view));
    return true;
  }
  const listeners = controls.map(control => {
    const handler = () => choose(control.dataset.analyticsView);
    control.addEventListener('click', handler);
    return [control, handler];
  });
  choose('all');
  return { choose, dispose() { for (const [control, handler] of listeners) control.removeEventListener('click', handler); delete nav.dataset.analyticsActiveView; } };
}
