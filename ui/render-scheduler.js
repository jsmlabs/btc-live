/** Coalesces visual updates only; data processing and notifications remain synchronous. */
export function createRenderScheduler(render, {
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (id) => globalThis.cancelAnimationFrame(id),
  clock = () => globalThis.performance?.now?.() ?? Date.now()
} = {}) {
  if (typeof render !== 'function' || typeof requestFrame !== 'function' || typeof cancelFrame !== 'function' || typeof clock !== 'function') {
    throw new TypeError('render scheduler adapters must be functions');
  }
  let pending = null;
  let dirty = false;
  let disposed = false;
  const metrics = {frames:0, requests:0, coalesced:0, errors:0, maxRenderMs:0, totalRenderMs:0};

  function draw() {
    pending = null;
    if (disposed || !dirty) return;
    dirty = false;
    const start=clock();
    try { render(); } catch (error) { metrics.errors++; throw error; }
    finally {
      const elapsed=Math.max(0,clock()-start);
      if (Number.isFinite(elapsed)) { metrics.totalRenderMs+=elapsed; metrics.maxRenderMs=Math.max(metrics.maxRenderMs,elapsed); }
      metrics.frames++;
    }
    if (dirty) schedule();
  }

  function schedule() {
    if (disposed) return;
    if (dirty) metrics.coalesced++;
    dirty = true;
    if (pending === null) { pending = requestFrame(draw); metrics.requests++; }
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

  function diagnostics(){return {...metrics,averageRenderMs:metrics.frames?metrics.totalRenderMs/metrics.frames:0,pending:pending!==null,disposed};}
  return { schedule, flush, dispose, diagnostics };
}
