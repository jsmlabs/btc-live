import { appendAlertHistory } from '../storage/alert-history.js';
import { loadAlertTargets, saveAlertTargets } from '../storage/alert-targets.js';

export const NOTIFICATION_STATE_STORAGE_KEY = 'btcLiveNotificationState';

export const DEFAULT_NOTIFICATION_STATE = Object.freeze({
  anchorPrice: null,
  lastPriceNotificationAt: 0,
  lastTargetNotificationAt: 0,
  lastConnectionNotificationAt: 0,
  lastConnectionStatus: null
});

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

function sanitizeOptionalPrice(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function sanitizeNotificationState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    anchorPrice: sanitizeOptionalPrice(source.anchorPrice),
    lastPriceNotificationAt: Number.isFinite(source.lastPriceNotificationAt) && source.lastPriceNotificationAt >= 0 ? source.lastPriceNotificationAt : 0,
    lastTargetNotificationAt: Number.isFinite(source.lastTargetNotificationAt) && source.lastTargetNotificationAt >= 0 ? source.lastTargetNotificationAt : 0,
    lastConnectionNotificationAt: Number.isFinite(source.lastConnectionNotificationAt) && source.lastConnectionNotificationAt >= 0 ? source.lastConnectionNotificationAt : 0,
    lastConnectionStatus: typeof source.lastConnectionStatus === 'string' ? source.lastConnectionStatus : null
  };
}

export async function loadNotificationState() {
  const api = extensionApi();
  if (!api?.storage?.local) return { ...DEFAULT_NOTIFICATION_STATE };
  const result = await api.storage.local.get(NOTIFICATION_STATE_STORAGE_KEY);
  return sanitizeNotificationState(result?.[NOTIFICATION_STATE_STORAGE_KEY]);
}

export async function saveNotificationState(state) {
  const sanitized = sanitizeNotificationState(state);
  const api = extensionApi();
  if (!api?.storage?.local) return sanitized;
  await api.storage.local.set({ [NOTIFICATION_STATE_STORAGE_KEY]: sanitized });
  return sanitized;
}

export async function createNativeNotification({ title, message, id = null }) {
  const api = extensionApi();
  if (!api?.notifications?.create) return false;
  const options = {
    type: 'basic',
    iconUrl: api.runtime?.getURL ? api.runtime.getURL('icons/icon128.png') : '../icons/icon128.png',
    title,
    message,
    priority: 0
  };
  await api.notifications.create(id ?? undefined, options);
  return true;
}

export function evaluatePriceMove({ currentPrice, anchorPrice, thresholdPercent }) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  if (!Number.isFinite(anchorPrice) || anchorPrice <= 0) return { initializeAnchor: currentPrice };
  if (!Number.isFinite(thresholdPercent) || thresholdPercent <= 0) return null;
  const changePercent = ((currentPrice - anchorPrice) / anchorPrice) * 100;
  if (Math.abs(changePercent) < thresholdPercent) return null;
  return {
    direction: changePercent > 0 ? 'up' : 'down',
    changePercent,
    currentPrice,
    previousAnchorPrice: anchorPrice
  };
}

export function evaluatePriceTargets(targets, currentPrice, at = Date.now()) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Array.isArray(targets)) {
    return { targets: Array.isArray(targets) ? targets : [], reached: [], changed: false };
  }

  let changed = false;
  const reached = [];
  const next = targets.map((target) => {
    if (!target?.enabled) return target;
    const isReached = target.direction === 'above' ? currentPrice >= target.price : currentPrice <= target.price;
    const shouldRearm = target.triggered && (target.direction === 'above' ? currentPrice < target.price : currentPrice > target.price);
    if (shouldRearm) {
      changed = true;
      return { ...target, triggered: false, triggeredAt: null, updatedAt: at };
    }
    if (isReached && !target.triggered) reached.push(target);
    return target;
  });

  reached.sort((a, b) => {
    if (a.direction === b.direction) return a.direction === 'above' ? b.price - a.price : a.price - b.price;
    return a.direction.localeCompare(b.direction);
  });
  return { targets: next, reached, changed };
}

export function createNotificationManager({
  notify = createNativeNotification,
  loadState = loadNotificationState,
  saveState = saveNotificationState,
  loadTargets = loadAlertTargets,
  saveTargets = saveAlertTargets,
  appendHistory = appendAlertHistory,
  source = 'view',
  now = () => Date.now(),
  withLock = defaultNotificationLock,
  minProcessIntervalMs = 1000,
  onWarning = (...args) => console.warn(...args)
} = {}) {
  let state = { ...DEFAULT_NOTIFICATION_STATE };
  let tail = Promise.resolve();
  let disposed = false;
  let lastProcessedAt = Number.NEGATIVE_INFINITY;
  let lastObservedConnectionStatus = null;

  function observe(snapshot) {
    if (disposed) return Promise.resolve();
    const at = now();
    const status = snapshot?.state?.connectionStatus ?? null;
    const connectionChanged = status !== null && status !== lastObservedConnectionStatus;
    if (status !== null) lastObservedConnectionStatus = status;
    if (!connectionChanged && at - lastProcessedAt < minProcessIntervalMs) return tail;
    lastProcessedAt = at;

    const task = tail.then(() => withLock(async () => {
      if (disposed) return;
      try {
        state = sanitizeNotificationState(await loadState());
      } catch (error) {
        onWarning('BTC Live notification state could not be refreshed', error);
      }
      if (disposed) return;
      await processSnapshot(snapshot, at);
    }));
    tail = task.catch((error) => onWarning('BTC Live notification processing failed', error));
    return task;
  }

  async function processSnapshot(snapshot, at) {
    const settings = snapshot?.settings;
    const market = snapshot?.state;
    if (!settings?.notificationsEnabled || !market) return;

    let changed = false;
    let explicitTargetHandled = false;
    const cooldownMs = Math.max(15, settings.notificationCooldownSeconds) * 1000;
    const currentPrice = Number.isFinite(market.currentPrice) && market.currentPrice > 0 ? market.currentPrice : null;

    if (currentPrice !== null) {
      let targets = [];
      try {
        targets = await loadTargets();
      } catch (error) {
        onWarning('BTC Live price targets could not be loaded', error);
      }
      const evaluation = evaluatePriceTargets(targets, currentPrice, at);
      targets = evaluation.targets;
      let targetsChanged = evaluation.changed;

      for (const target of evaluation.reached) {
        const cooldownActive = at - state.lastTargetNotificationAt < cooldownMs;
        const title = target.label ? `BTC target: ${target.label}` : 'BTC price target reached';
        const relation = target.direction === 'above' ? 'at or above' : 'at or below';
        const message = `BTC is at ${formatPrice(currentPrice)} USDT, ${relation} ${formatPrice(target.price)} USDT.`;
        let sent = false;

        if (!explicitTargetHandled && !cooldownActive) {
          try {
            sent = await notify({ id: `btc-live-target-${target.id}`, title, message }) !== false;
          } catch (error) {
            await safeAppendHistory({
              id: `target-${target.id}-${at}`,
              at, type: 'target', status: 'failed', source, title, message,
              currentPrice, targetId: target.id, targetPrice: target.price,
              direction: target.direction, reason: 'notification_error'
            });
            onWarning('BTC Live target notification failed', error);
          }
        }

        const status = sent ? 'sent' : 'suppressed';
        if (sent) {
          state.lastTargetNotificationAt = at;
          state.anchorPrice = currentPrice;
          state.lastPriceNotificationAt = at;
          changed = true;
          explicitTargetHandled = true;
        }
        if (!sent) {
          await safeAppendHistory({
            id: `target-${target.id}-${at}`,
            at, type: 'target', status, source, title, message,
            currentPrice, targetId: target.id, targetPrice: target.price,
            direction: target.direction,
            reason: cooldownActive || explicitTargetHandled ? 'cooldown_or_batch' : 'notification_unavailable'
          });
        } else {
          await safeAppendHistory({
            id: `target-${target.id}-${at}`,
            at, type: 'target', status, source, title, message,
            currentPrice, targetId: target.id, targetPrice: target.price, direction: target.direction
          });
        }

        targets = targets.map((item) => item.id === target.id
          ? { ...item, triggered: true, triggeredAt: at, updatedAt: at }
          : item);
        targetsChanged = true;
      }

      if (targetsChanged) {
        try {
          await saveTargets(targets);
        } catch (error) {
          onWarning('BTC Live price target state could not be saved', error);
        }
      }
    }

    if (settings.notifyPriceMove && !explicitTargetHandled) {
      const priceResult = evaluatePriceMove({
        currentPrice,
        anchorPrice: state.anchorPrice,
        thresholdPercent: settings.priceMovePercentThreshold
      });
      if (priceResult?.initializeAnchor) {
        state.anchorPrice = priceResult.initializeAnchor;
        changed = true;
      } else if (priceResult && at - state.lastPriceNotificationAt >= cooldownMs) {
        const sign = priceResult.changePercent > 0 ? '+' : '';
        const title = `BTC moved ${priceResult.direction}`;
        const message = `${sign}${priceResult.changePercent.toFixed(2)}% to ${formatPrice(priceResult.currentPrice)} USDT since the last alert anchor.`;
        const sent = await notify({ id: 'btc-live-price-move', title, message });
        if (sent !== false) {
          state.anchorPrice = priceResult.currentPrice;
          state.lastPriceNotificationAt = at;
          changed = true;
          await safeAppendHistory({
            id: `price-move-${at}`, at, type: 'price_move', status: 'sent', source,
            title, message, currentPrice, direction: priceResult.direction
          });
        }
      }
    } else if (!settings.notifyPriceMove && currentPrice !== null && state.anchorPrice !== currentPrice) {
      state.anchorPrice = currentPrice;
      changed = true;
    }

    const status = typeof market.connectionStatus === 'string' ? market.connectionStatus : null;
    if (settings.notifyConnectionIssues && status && status !== state.lastConnectionStatus) {
      const isIssue = ['OFFLINE', 'STALE', 'ERROR'].includes(status);
      const recovered = state.lastConnectionStatus && ['OFFLINE', 'STALE', 'ERROR', 'RECONNECTING'].includes(state.lastConnectionStatus) && status === 'LIVE';
      if ((isIssue || recovered) && at - state.lastConnectionNotificationAt >= cooldownMs) {
        const title = recovered ? 'BTC Live connection restored' : `BTC Live ${status.toLowerCase()}`;
        const message = recovered ? 'Validated live market data is available again.' : connectionMessage(status, market.errorMessage);
        const sent = await notify({ id: 'btc-live-connection', title, message });
        if (sent !== false) {
          state.lastConnectionNotificationAt = at;
          changed = true;
          await safeAppendHistory({
            id: `connection-${at}`, at, type: 'connection', status: 'sent', source,
            title, message, currentPrice
          });
        }
      }
      state.lastConnectionStatus = status;
      changed = true;
    } else if (status && status !== state.lastConnectionStatus) {
      state.lastConnectionStatus = status;
      changed = true;
    }

    if (changed) state = await saveState(state);
  }

  async function safeAppendHistory(entry) {
    try {
      await appendHistory(entry);
    } catch (error) {
      onWarning('BTC Live alert history could not be updated', error);
    }
  }

  function dispose() {
    disposed = true;
  }

  return { observe, dispose };
}

async function defaultNotificationLock(task) {
  const locks = globalThis.navigator?.locks;
  if (locks?.request) return locks.request('btc-live-notification-state', task);
  return task();
}

function formatPrice(value) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function connectionMessage(status, detail) {
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (status === 'OFFLINE') return 'The browser reports that the network connection is offline.';
  if (status === 'STALE') return 'Live BTC market data is stale and may be delayed.';
  return 'BTC Live encountered a market-data connection problem.';
}
