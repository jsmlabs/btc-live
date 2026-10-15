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
  let adding = false, clearing = false;
  const pendingTargets = new Set();
  function report(message, tone = 'neutral', history = false) {
    if (disposed) return;
    const node = getNode(history ? (ids.historyFeedback ?? ids.feedback) : ids.feedback);
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
    node.hidden = !message;
  }

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
      appendText(info, 'small', '', `${target.direction === 'above' ? '↑' : '↓'} ${formatPrice(target.price)} USDT · ${!target.enabled ? 'paused' : target.triggered ? 'waiting to re-arm' : 'armed'}`);

      const actions = document.createElement('div');
      actions.className = 'alert-target-actions';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'mini-button';
      toggle.dataset.action = 'toggle';
      toggle.dataset.targetId = target.id;
      toggle.dataset.enabled = String(target.enabled);
      toggle.textContent = target.enabled ? 'Pause' : 'Resume';
      toggle.setAttribute('aria-label', `${target.enabled ? 'Disable' : 'Enable'} ${title}`);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'mini-button danger';
      remove.dataset.action = 'remove';
      remove.dataset.targetId = target.id;
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${title}`);
      toggle.disabled = remove.disabled = pendingTargets.has(target.id);

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
    const clear = getNode(ids.clearHistory);
    if (clear) clear.disabled = clearing || history.length === 0;

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
    if (adding || disposed) return;
    const direction = getNode(ids.direction)?.value;
    const priceInput = getNode(ids.price);
    const labelInput = getNode(ids.label);
    const price = Number(priceInput?.value);
    const submit = getNode(ids.form)?.querySelector('button[type="submit"]');
    adding = true;
    if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
    report('Saving target…');
    try {
      await addAlertTarget({ direction, price, label: labelInput?.value ?? '' });
      if (priceInput) priceInput.value = '';
      if (labelInput) labelInput.value = '';
      await refreshTargets();
      await onTargetsChanged();
      report('Price target saved.', 'positive');
      if (!disposed && (document.activeElement === document.body || getNode(ids.form)?.contains(document.activeElement))) priceInput?.focus({ preventScroll: true });
    } catch (error) {
      report(error instanceof Error ? error.message : 'Could not add price target.', 'negative');
    } finally {
      adding = false;
      if (!disposed && submit) { submit.disabled = false; submit.removeAttribute('aria-busy'); }
    }
  }

  async function handleTargetAction(event) {
    const button = event.target.closest?.('button[data-action][data-target-id]');
    if (!button) return;
    const id = button.dataset.targetId;
    if (pendingTargets.has(id) || disposed) return;
    pendingTargets.add(id);
    const list = getNode(ids.targetList);
    const buttons = [...list.querySelectorAll('button')];
    const index = buttons.indexOf(button);
    for (const sibling of buttons.filter(node => node.dataset.targetId === id)) sibling.disabled = true;
    const removing = button.dataset.action === 'remove';
    const enabling = button.dataset.enabled !== 'true';
    try {
      if (removing) await removeAlertTarget(id);
      else if (button.dataset.action === 'toggle') await updateAlertTarget(id, { enabled: enabling });
      await onTargetsChanged();
      report(removing ? 'Price target removed.' : enabling ? 'Price target resumed.' : 'Price target paused.', 'positive');
    } catch (error) {
      report(error instanceof Error ? error.message : 'Could not update price target.', 'negative');
    } finally {
      pendingTargets.delete(id);
      try { await refreshTargets(); }
      catch { report('Could not reload price targets. Reopen this view to retry.', 'negative'); }
      if (!disposed && (document.activeElement === document.body || document.activeElement === button || document.activeElement?.dataset?.targetId === id)) {
        const next = [...list.querySelectorAll('button')];
        const match = next.find(node => node.dataset.targetId === id && node.dataset.action === button.dataset.action);
        (match ?? next[Math.min(index, next.length - 1)] ?? getNode(ids.price))?.focus({ preventScroll: true });
      }
    }
  }

  async function handleClearHistory() {
    if (clearing || disposed) return;
    clearing = true;
    const clear = getNode(ids.clearHistory);
    clear.disabled = true;
    report('Clearing history…', 'neutral', true);
    try {
      await clearAlertHistory();
      report('Alert history cleared.', 'positive', true);
    } catch (error) {
      report(error instanceof Error ? error.message : 'Could not clear history.', 'negative', true);
    } finally {
      clearing = false;
      try { await refreshHistory(); }
      catch { clear.disabled = false; report('Could not reload alert history.', 'negative', true); }
    }
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
