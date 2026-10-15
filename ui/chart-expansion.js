// A native modal keeps keyboard and pointer interaction within the expanded chart.
export function createChartExpansion({ root = document, redraw = () => {} } = {}) {
  const panel = root.querySelector('.chart-panel');
  const home = panel.parentElement;
  const dialog = root.getElementById('dashboardChartDialog');
  const button = root.getElementById('dashboardChartFocus');
  let scrollPosition = 0;
  function restore() {
    if (dialog.open || panel.parentElement !== dialog) return;
    panel.classList.remove('chart-focus');
    home.append(panel);
    root.documentElement.classList.remove('chart-expanded');
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Expand chart';
    root.defaultView?.scrollTo({ top: scrollPosition, behavior: 'instant' });
    if (!home.hidden) button.focus({ preventScroll: true });
    redraw();
  }
  function setExpanded(active) {
    if (!active) { if (dialog.open) dialog.close(); restore(); return; }
    if (dialog.open) return;
    scrollPosition = root.defaultView?.scrollY ?? 0;
    for (const menu of panel.querySelectorAll('.chart-menu[open]')) menu.open = false;
    dialog.append(panel);
    panel.classList.add('chart-focus');
    root.documentElement.classList.add('chart-expanded');
    button.setAttribute('aria-pressed', 'true');
    button.textContent = 'Restore chart';
    dialog.showModal();
    button.focus({ preventScroll: true });
    redraw();
  }
  const onClick = () => setExpanded(!dialog.open);
  const onCancel = event => { event.preventDefault(); setExpanded(false); };
  button.addEventListener('click', onClick);
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('close', restore);
  return { setExpanded, expanded: () => dialog.open, dispose() {
    setExpanded(false);
    button.removeEventListener('click', onClick);
    dialog.removeEventListener('cancel', onCancel);
    dialog.removeEventListener('close', restore);
  } };
}
