export const SUPPORT_ADDRESS = '7CPrqUu3ioFtdiPrx7APLvpf6if2P4ZZiLKPrJAUyKu3';

export function mountSupportDialog({ doc = document, clipboard = globalThis.navigator?.clipboard } = {}) {
  const dialog = doc.getElementById('supportDialog');
  const address = doc.getElementById('supportAddress');
  const copy = doc.getElementById('supportCopy');
  const feedback = doc.getElementById('supportCopyFeedback');
  const close = doc.getElementById('supportClose');
  const done = doc.getElementById('supportDone');
  const triggers = [...doc.querySelectorAll('[data-support-open]')];
  if (!dialog || !address || !copy || !feedback || !close || !done || !triggers.length) {
    throw Error('BTC Live support dialog markup is incomplete');
  }
  if (address.value.trim() !== SUPPORT_ADDRESS) throw Error('BTC Live support destination mismatch');
  let session = 0;
  let opener = null;
  let disposed = false;

  function reset() {
    session++;
    copy.disabled = false;
    copy.textContent = 'Copy address';
    feedback.textContent = '';
  }
  function open(event) {
    if (disposed || dialog.open) return;
    opener = event.currentTarget;
    reset();
    dialog.showModal();
    copy.focus();
  }
  function requestClose() {
    if (dialog.open) dialog.close();
  }
  function onClose() {
    reset();
    if (opener?.isConnected) opener.focus();
    opener = null;
  }
  async function onCopy() {
    if (disposed || !dialog.open || copy.disabled) return;
    const current = session;
    copy.disabled = true;
    copy.textContent = 'Copying…';
    try {
      if (typeof clipboard?.writeText !== 'function') throw Error('Clipboard unavailable');
      await clipboard.writeText(SUPPORT_ADDRESS);
      if (disposed || current !== session || !dialog.open) return;
      copy.textContent = 'Copied';
      feedback.textContent = 'Address copied. Verify it before sending.';
    } catch {
      if (disposed || current !== session || !dialog.open) return;
      address.focus();
      address.select();
      copy.textContent = 'Copy address';
      feedback.textContent = 'Clipboard unavailable. Select and copy the address manually.';
    } finally {
      if (!disposed && current === session && dialog.open) copy.disabled = false;
    }
  }
  for (const trigger of triggers) trigger.addEventListener('click', open);
  close.addEventListener('click', requestClose);
  done.addEventListener('click', requestClose);
  copy.addEventListener('click', onCopy);
  dialog.addEventListener('close', onClose);
  return function dispose() {
    if (disposed) return;
    disposed = true;
    session++;
    for (const trigger of triggers) trigger.removeEventListener('click', open);
    close.removeEventListener('click', requestClose);
    done.removeEventListener('click', requestClose);
    copy.removeEventListener('click', onCopy);
    dialog.removeEventListener('close', onClose);
    if (dialog.open) dialog.close();
  };
}
