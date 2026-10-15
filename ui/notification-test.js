import { createNativeNotification } from '../app/notifications.js';

// API acceptance is reported separately from OS delivery, which cannot be verified here.
export function bindNotificationTest({ button, feedback, notify = createNativeNotification } = {}) {
  let busy = false, disposed = false;
  function report(text, tone) {
    if (disposed) return;
    feedback.textContent = text;
    feedback.dataset.tone = tone;
    feedback.hidden = false;
  }
  async function run() {
    if (busy || disposed) return;
    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    report('Requesting a test notification…', 'neutral');
    try {
      const accepted = await notify({ id: 'btc-live-test', title: 'BTC Live notification test', message: 'This is a test notification from BTC Live.' });
      report(accepted === false
        ? 'Browser notifications are unavailable. Check extension permissions.'
        : 'Browser accepted the request. Check your system notifications; delivery is not guaranteed.',
      accepted === false ? 'warning' : 'positive');
    } catch (error) {
      console.warn('BTC Live test notification failed', error);
      report('Test notification failed. Check browser and system notification permissions.', 'negative');
    } finally {
      busy = false;
      if (!disposed) { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  }
  button.addEventListener('click', run);
  return { run, dispose() { disposed = true; button.removeEventListener('click', run); } };
}
