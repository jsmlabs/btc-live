import {
  addAlertTarget,
  loadAlertTargets,
  removeAlertTarget,
  updateAlertTarget
} from '../storage/alert-targets.js';
import { clearAlertHistory, loadAlertHistory } from '../storage/alert-history.js';

function getNode(id) {
  return document.getElementById(id);
}

function formatPrice(value) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWhen(at) {
  if (!Number.isFinite(at)) return 'Unknown time';
  return new Date(at).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function appendText(parent, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

export function createAlertCenterController({ ids, onTargetsChanged = () => {} } = {}) {
  let disposed = false;

  async function refreshTargets() {
    if (disposed) return;
    const targets = await loadAlertTargets();
    renderTargets(targets);
  }

  async function refreshHistory() {
    if (disposed) return;
    const history = await loadAlertHistory();
    renderHistory(history);
  }

  async function refresh() {
    await Promise.all([refreshTargets(), refreshHistory()]);
  }

  function renderTargets(targets) {
    const list = getNode(ids.targetList);
    const count = getNode(ids.targetCount);
    if (!list || !count) return;
    clearChildren(list);
    const enabledCount = targets.filter((target) => target.enabled).length;
    count.textContent = `${enabledCount}/${targets.length} active`;

    if (targets.length === 0) {
      appendText(list, 'li', 'alert-empty', 'No price targets configured.');
      return;
    }

    const sorted = [...targets].sort((a, b) => {
      if (a.direction !== b.direction) return a.direction.localeCompare(b.direction);
      return a.direction === 'above' ? a.price - b.price : b.price - a.price;
    });

    for (const target of sorted) {
      const item = document.createElement('li');
      item.className = 'alert-target-item';
      item.dataset.enabled = String(target.enabled);

      const info = document.createElement('div');
      info.className = 'alert-target-info';
      const title = target.label || (target.direction === 'above' ? 'Above target' : 'Below target');
      appendText(info, 'strong', '', title);
      appendText(info, 'small', '', `${target.direction === 'above' ? '↑' : '↓'} ${formatPrice(target.price)} USDT · ${target.triggered ? 'waiting to re-arm' : 'armed'}`);

      const actions = document.createElement('div');
      actions.className = 'alert-target-actions';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'mini-button';
      toggle.dataset.action = 'toggle';
      toggle.dataset.targetId = target.id;
      toggle.dataset.enabled = String(target.enabled);
      toggle.textContent = target.enabled ? 'On' : 'Off';
      toggle.setAttribute('aria-label', `${target.enabled ? 'Disable' : 'Enable'} ${title}`);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'mini-button danger';
      remove.dataset.action = 'remove';
      remove.dataset.targetId = target.id;
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${title}`);

      actions.append(toggle, remove);
      item.append(info, actions);
      list.append(item);
    }
  }

  function renderHistory(history) {
    const list = getNode(ids.historyList);
    const count = getNode(ids.historyCount);
    if (!list || !count) return;
    clearChildren(list);
    count.textContent = `${history.length} event${history.length === 1 ? '' : 's'}`;

    if (history.length === 0) {
      appendText(list, 'li', 'alert-empty', 'No alert events yet.');
      return;
    }

    for (const entry of history.slice(0, 20)) {
      const item = document.createElement('li');
      item.className = 'alert-history-item';
      item.dataset.status = entry.status;
      const top = document.createElement('div');
      top.className = 'alert-history-top';
      appendText(top, 'strong', '', entry.title || entry.type.replace('_', ' '));
      appendText(top, 'span', 'alert-history-status', entry.status.toUpperCase());
      item.append(top);
      appendText(item, 'small', '', entry.message || 'No detail');
      appendText(item, 'time', '', `${formatWhen(entry.at)} · ${entry.source}`);
      list.append(item);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    const direction = getNode(ids.direction)?.value;
    const priceInput = getNode(ids.price);
    const labelInput = getNode(ids.label);
    const price = Number(priceInput?.value);
    const feedback = getNode(ids.feedback);
    try {
      await addAlertTarget({ direction, price, label: labelInput?.value ?? '' });
      if (priceInput) priceInput.value = '';
      if (labelInput) labelInput.value = '';
      if (feedback) feedback.textContent = '';
      await refreshTargets();
      await onTargetsChanged();
    } catch (error) {
      if (feedback) feedback.textContent = error instanceof Error ? error.message : 'Could not add price target.';
    }
  }

  async function handleTargetAction(event) {
    const button = event.target.closest?.('button[data-action][data-target-id]');
    if (!button) return;
    const id = button.dataset.targetId;
    if (button.dataset.action === 'remove') {
      await removeAlertTarget(id);
    } else if (button.dataset.action === 'toggle') {
      await updateAlertTarget(id, { enabled: button.dataset.enabled !== 'true' });
    }
    await refreshTargets();
    await onTargetsChanged();
  }

  async function handleClearHistory() {
    await clearAlertHistory();
    await refreshHistory();
  }

  function bind() {
    getNode(ids.form)?.addEventListener('submit', handleAdd);
    getNode(ids.targetList)?.addEventListener('click', handleTargetAction);
    getNode(ids.clearHistory)?.addEventListener('click', handleClearHistory);
  }

  function dispose() {
    disposed = true;
    getNode(ids.form)?.removeEventListener('submit', handleAdd);
    getNode(ids.targetList)?.removeEventListener('click', handleTargetAction);
    getNode(ids.clearHistory)?.removeEventListener('click', handleClearHistory);
  }

  bind();
  return { refresh, refreshTargets, refreshHistory, dispose };
}
