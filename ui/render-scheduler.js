/** Coalesces visual updates only; data processing and notifications remain synchronous. */
export function createRenderScheduler(render, {
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (id) => globalThis.cancelAnimationFrame(id)
} = {}) {
  if (typeof render !== 'function' || typeof requestFrame !== 'function' || typeof cancelFrame !== 'function') {
    throw new TypeError('render scheduler adapters must be functions');
  }
  let pending = null;
  let dirty = false;
  let disposed = false;

  function draw() {
    pending = null;
    if (disposed || !dirty) return;
    dirty = false;
    render();
    if (dirty) schedule();
  }

  function schedule() {
    if (disposed) return;
    dirty = true;
    if (pending === null) pending = requestFrame(draw);
  }

  function flush() {
    if (disposed || !dirty) return;
    if (pending !== null) cancelFrame(pending);
    draw();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    dirty = false;
    if (pending !== null) cancelFrame(pending);
    pending = null;
  }

  return { schedule, flush, dispose };
}
