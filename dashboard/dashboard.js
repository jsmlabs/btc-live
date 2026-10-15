import { mountSoftwareUpdates } from '../ui/software-update-panel.js';
let updatePanelDispose = () => {};
import {createAdvancedAlertCenter} from '../ui/advanced-alert-center.js';
import { clampReplayPosition, addReplayBookmark, compareReplaySessions } from '../ui/replay-research.js';
import { createTerminalExperience } from '../ui/terminal-experience.js';
import { createChartExpansion } from '../ui/chart-expansion.js';
import { bindNotificationTest } from '../ui/notification-test.js';
import { bindDisclosureMenus } from '../ui/disclosure-menus.js';
import { createWorkspaceController, createReplayModeController } from '../ui/workspace.js';
import { bindAnalyticsViews } from '../ui/analytics-views.js';
import { WORKSPACE_STORAGE_KEY, loadWorkspace, saveWorkspace, sanitizeWorkspace } from '../storage/workspace-preferences.js';
import { createMarketRecorder, REPLAY_MAX_BYTES } from '../ui/market-recorder.js';
import { createEventRecorder, EVENT_MAX_BYTES } from '../ui/event-recorder.js';
import { createReplaySessionStore } from '../storage/replay-sessions.js';
import { replayEventRecording } from '../ui/event-replay.js';
import { createEventReplayRenderer } from '../ui/event-replay-render.js';
import { createMarketReplayRenderer } from '../ui/market-replay-render.js';
import { createFeedDiagnostics } from '../market/feed-diagnostics.js';
import { deriveLiquidityBands } from '../ui/liquidity.js';
import { createBtcChartRuntime } from '../app/chart-runtime.js';
import { createBinanceDepthRuntime } from '../market/binance-depth.js';
import { createBinanceAggTradeRuntime } from '../market/binance-aggtrades.js';
import { createOrderFlowAccumulator } from '../ui/order-flow.js';
import { evaluateLiquidityBehavior, evaluateLiquidityPersistence } from '../ui/liquidity-behavior.js';
import { createOrderFlowRenderer } from '../ui/order-flow-render.js';
import { DEFAULT_FLOW_PREFERENCES, FLOW_PREFERENCES_KEY, loadFlowPreferences, saveFlowPreferences, sanitizeFlowPreferences } from '../storage/flow-preferences.js';
import { createDepthHistory } from '../ui/depth-history.js';
import { createLiquidityHistoryRenderer } from '../ui/liquidity-history.js';
import { DEFAULT_LIQUIDITY_PREFERENCES, LIQUIDITY_PREFERENCES_KEY, loadLiquidityPreferences, saveLiquidityPreferences, sanitizeLiquidityPreferences } from '../storage/liquidity-preferences.js';
import { createLiquidityRenderer } from '../ui/liquidity.js';
import { createBtcLiveRuntime } from '../app/runtime.js';
import { createNotificationManager } from '../app/notifications.js';
import { ALERT_HISTORY_STORAGE_KEY } from '../storage/alert-history.js';
import { ALERT_TARGETS_STORAGE_KEY } from '../storage/alert-targets.js';
import { createAlertCenterController } from '../ui/alert-center.js';
import { CHART_PREFERENCES_STORAGE_KEY, sanitizeChartPreferences } from '../storage/chart-preferences.js';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, sanitizeSettings } from '../storage/settings.js';
import { renderBtcChart, getRenderedChartModel } from '../ui/chart.js';
import { createDrawingStore, bindChartDrawings } from '../ui/chart-drawings.js';
import { renderChartMarketOverlays } from '../ui/chart-market-overlays.js';
import { sanitizeAlertTargets, loadAlertTargets } from '../storage/alert-targets.js';
import { createChartViewport } from '../ui/chart-viewport.js';
import { bindChartInteractions } from '../ui/chart-interactions.js';
import { renderDashboard } from '../ui/dashboard-render.js';
import { createRenderScheduler } from '../ui/render-scheduler.js';

const eventRecorder = createEventRecorder();
const savedSessions = createReplaySessionStore();
let sessionBusy = false;
const eventView = createEventReplayRenderer();
const eventById = (name) => document.getElementById(`dashboardEvent${name}`);
let eventFrames = [], eventPosition = 0, eventPlaying = false, eventTimer = null;
let eventFeedState = { depth: null, trades: null };
let eventBookmarks = [];
function clearEventResearch() { eventBookmarks = []; eventById('BookmarkNote').value = ''; eventById('CompareResult').textContent = 'Select a saved session to compare with the current replay.'; }
function drawEventResearch() {
  const list = eventById('Bookmarks');
  list.replaceChildren(new Option(eventBookmarks.length ? 'Jump to bookmark' : 'No bookmarks', ''));
  for (const b of eventBookmarks) list.add(new Option(`#${b.index + 1} · ${new Date(b.at).toLocaleTimeString()}${b.note ? ' · '+b.note : ''}`, String(b.index)));
  eventById('BookmarkAdd').disabled = !eventFrames.length || eventRecorder.state().status === 'RECORDING';
  eventById('StepBack').disabled = !eventFrames.length || eventPosition <= 0;
  eventById('StepForward').disabled = !eventFrames.length || eventPosition >= eventFrames.length - 1;
}

function stopEventPlayback() {
  eventPlaying = false;
  if (eventTimer !== null) clearTimeout(eventTimer);
  eventTimer = null;
}
function drawEvents() {
  const captured = eventRecorder.snapshot();
  eventById('Panel').dataset.replayState = captured.status.toLowerCase();
  eventView.render(eventFrames, eventPosition, `${eventPlaying ? 'PLAYBACK · ' : ''}${captured.status}${!captured.trustedCapture ? ' · UNVERIFIED IMPORT' : ''}`);
  eventById('Start').disabled = captured.status === 'RECORDING';
  eventById('Stop').disabled = captured.status !== 'RECORDING';
  eventById('Play').disabled = !eventFrames.length || captured.status === 'RECORDING';
  eventById('Play').textContent = eventPlaying ? 'Pause' : 'Play';
  eventById('Export').disabled = !captured.events.length;
  eventById('SaveSession').disabled = sessionBusy || !captured.events.length || captured.status === 'RECORDING';
  drawEventResearch();
  if (captured.status === 'RECORDING') eventById('Details').textContent = `Capturing ${captured.events.length} events · ${captured.bytes} bytes; no background capture`;
}
function rebuildEventFrames() {
  const data = eventRecorder.snapshot();
  try { eventFrames = data.events.length ? replayEventRecording(eventRecorder.exportJson(), 50) : []; }
  catch (error) { eventFrames = []; eventById('Feedback').textContent = `Replay cannot be reconstructed: ${error.message}`; }
  eventPosition = Math.max(0, eventFrames.length - 1);
  clearEventResearch();
  drawEvents();
}
function stopEventRecorder() {
  eventRecorder.stop();
  rebuildEventFrames();
}
function appendMarketEvent(kind, event, at = Date.now()) {
  if (eventRecorder.state().status !== 'RECORDING') return;
  const accepted = eventRecorder.append(kind, event, at);
  if (!accepted || eventRecorder.state().status !== 'RECORDING') {
    stopEventRecorder();
    eventById('Feedback').textContent = 'Event capture stopped at capacity or on invalid/discontinuous input.';
  }
}
function startEventRecorder() {
  stopEventPlayback();
  eventRecorder.start(); eventFrames = []; eventPosition = 0; clearEventResearch();
  eventFeedState = { depth: null, trades: null };
  const now = Date.now();
  if (latestDepth.status === 'LIVE' && latestDepth.book) {
    appendMarketEvent('depth.snapshot', { updateId: latestDepth.book.updateId,
      bids: [...latestDepth.book.bids], asks: [...latestDepth.book.asks] }, now);
  } else appendMarketEvent('gap', {feed:'depth',status: ['RECONNECTING','PAUSED','SYNCING','CONNECTING'].includes(latestDepth.status)?latestDepth.status:'UNAVAILABLE'},now);
  if (latestFlowFeed.status !== 'LIVE') appendMarketEvent('gap', {feed:'trades',status: ['RECONNECTING','PAUSED','CONNECTING'].includes(latestFlowFeed.status)?latestFlowFeed.status:'UNAVAILABLE'},now);
  eventFeedState.depth = latestDepth.status; eventFeedState.trades = latestFlowFeed.status;
  eventById('Feedback').textContent = 'Opt-in session capture active; Futures depth and trades only. Hidden/offline stops capture.';
  drawEvents();
}
function eventStep() {
  if (!eventPlaying || eventPosition >= eventFrames.length - 1) { stopEventPlayback(); drawEvents(); return; }
  const speed = Number(eventById('Speed').value) || 1;
  const next = eventFrames[eventPosition + 1];
  const delay = Math.max(16, Math.floor((next.at - eventFrames[eventPosition].at) / speed));
  eventTimer = setTimeout(() => { eventTimer = null; eventPosition++; drawEvents(); eventStep(); }, delay);
}
function playEventReplay() {
  if (eventPlaying) { stopEventPlayback(); drawEvents(); return; }
  if (!eventFrames.length) return;
  if (eventPosition >= eventFrames.length - 1) eventPosition = 0;
  eventPlaying = true;
  drawEvents(); eventStep();
}
async function refreshSavedSessions() {
  const selector = eventById('Sessions');
  const previous = selector.value;
  const sessions = await savedSessions.list();
  selector.replaceChildren();
  selector.add(new Option(sessions.length ? 'Select saved session' : 'No saved sessions', ''));
  for (const session of sessions) {
    selector.add(new Option(`${session.name} · ${new Date(session.createdAt).toLocaleString()} · ${(session.storedBytes/1024).toFixed(0)} KiB`, session.id));
  }
  if (sessions.some((session) => session.id === previous)) selector.value = previous;
  eventById('LoadSession').disabled = !selector.value || sessionBusy;
  eventById('DeleteSession').disabled = !selector.value || sessionBusy;
}
async function withSessionOperation(operation) {
  if (sessionBusy) return;
  sessionBusy = true;
  eventById('SaveSession').disabled = true;
  eventById('LoadSession').disabled = true;
  eventById('DeleteSession').disabled = true;
  try { await operation(); }
  catch (error) { eventById('SessionFeedback').textContent = `Session operation failed: ${error.message}`; }
  finally { sessionBusy = false; try { await refreshSavedSessions(); } catch (error) { eventById('SessionFeedback').textContent = `Local storage unavailable: ${error.message}`; } drawEvents(); }
}
function bindEventReplay() {
  eventById('SaveSession').addEventListener('click', () => withSessionOperation(async () => {
    if (eventRecorder.state().status === 'RECORDING') throw new Error('Stop recording before saving');
    const name = eventById('SessionName').value.trim();
    const saved = await savedSessions.save(eventRecorder.exportJson(), name);
    eventById('SessionFeedback').textContent = `Saved locally: ${saved.name} · ${saved.storedBytes} bytes · integrity protected.`;
  }));
  eventById('Sessions').addEventListener('change', () => {
    const enabled = Boolean(eventById('Sessions').value) && !sessionBusy;
    eventById('LoadSession').disabled = !enabled;
    eventById('DeleteSession').disabled = !enabled;
  });
  eventById('LoadSession').addEventListener('click', () => withSessionOperation(async () => {
    const id = eventById('Sessions').value;
    if (!id) throw new Error('Choose a session');
    const saved = await savedSessions.load(id);
    // Complete integrity and event validation happens before any UI state is changed.
    stopEventPlayback(); stopEventRecorder(); eventRecorder.load(saved.text); rebuildEventFrames();
    eventById('SessionFeedback').textContent = `Loaded local saved session: ${saved.metadata.name}. UNVERIFIED OFFLINE REPLAY, never live prices or alerts.`;
  }));
  eventById('DeleteSession').addEventListener('click', () => withSessionOperation(async () => {
    const id = eventById('Sessions').value;
    if (!id) throw new Error('Choose a session');
    if (!window.confirm('Permanently delete the selected saved replay session?')) return;
    await savedSessions.remove(id);
    eventById('SessionFeedback').textContent = 'Selected saved session deleted from this browser profile.';
  }));
  void refreshSavedSessions().catch((error) => { eventById('SessionFeedback').textContent = `Local storage unavailable: ${error.message}`; });
  eventById('StepBack').addEventListener('click', () => { stopEventPlayback(); eventPosition = clampReplayPosition(eventFrames.length, eventPosition - 1); drawEvents(); });
  eventById('StepForward').addEventListener('click', () => { stopEventPlayback(); eventPosition = clampReplayPosition(eventFrames.length, eventPosition + 1); drawEvents(); });
  eventById('BookmarkAdd').addEventListener('click', () => {
    try { eventBookmarks = addReplayBookmark(eventBookmarks, eventFrames, eventPosition, eventById('BookmarkNote').value.trim()); drawEventResearch(); }
    catch (error) { eventById('Feedback').textContent = `Bookmark rejected: ${error.message}`; }
  });
  eventById('Bookmarks').addEventListener('change', () => {
    if (!eventById('Bookmarks').value) return;
    stopEventPlayback(); eventPosition = clampReplayPosition(eventFrames.length, Number(eventById('Bookmarks').value)); drawEvents();
  });
  eventById('Compare').addEventListener('click', () => withSessionOperation(async () => {
    const id = eventById('Sessions').value;
    if (!id || !eventFrames.length) throw new Error('Load or record current events and select a saved comparison session');
    const saved = await savedSessions.load(id);
    const other = replayEventRecording(saved.text, 50);
    const result = compareReplaySessions(eventFrames, other);
    const describe = x => `${x.events} events · ${(x.durationMs / 1000).toFixed(1)}s · depth ${x.depthCount}/${x.events} · flow ${x.flowCount}/${x.events} · price Δ ${x.priceChange === null ? 'N/A' : x.priceChange.toFixed(2) + ' USDT'}`;
    eventById('CompareResult').textContent = `Current: ${describe(result.a)} | Saved (${saved.metadata.name}): ${describe(result.b)}. ${result.note}`;
  }));
  eventById('Start').addEventListener('click', startEventRecorder);
  eventById('Stop').addEventListener('click', stopEventRecorder);
  eventById('Play').addEventListener('click', playEventReplay);
  eventById('Speed').addEventListener('change', () => { if (eventPlaying) { stopEventPlayback(); playEventReplay(); } });
  eventById('Position').addEventListener('input', (event) => { stopEventPlayback(); eventPosition = Number(event.target.value); drawEvents(); });
  eventById('Clear').addEventListener('click', () => { stopEventPlayback();eventRecorder.clear();eventFrames=[];eventPosition=0;clearEventResearch();drawEvents(); });
  eventById('Export').addEventListener('click', () => {
    try {
      const url=URL.createObjectURL(new Blob([eventRecorder.exportJson()],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='btc-live-futures-events-v2.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error){eventById('Feedback').textContent=error.message;}
  });
  eventById('Import').addEventListener('change',async(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    try {
      if(file.size>EVENT_MAX_BYTES)throw new Error('Event recording exceeds 4 MiB');
      const text=await file.text();stopEventPlayback();stopEventRecorder();eventRecorder.load(text);rebuildEventFrames();
      eventById('Feedback').textContent='UNVERIFIED IMPORT · Strictly validated offline USD-M Futures receipt log; never live prices or alerts.';
    } catch(error){eventById('Feedback').textContent=`Event import rejected: ${error.message}`;}
    finally{event.target.value='';}
  });
  drawEvents();
}
function handleEventFeed(feed, status) {
  if (status === eventFeedState[feed]) return;
  eventFeedState[feed] = status;
  if (status !== 'LIVE') appendMarketEvent('gap',{feed,status:['PAUSED','RECONNECTING','STALE','CONNECTING','SYNCING','IDLE'].includes(status)?status:'UNAVAILABLE'});
}

const recorder = createMarketRecorder();
const replayView = createMarketReplayRenderer();
const feedDiagnostics = createFeedDiagnostics();
let replayPosition = 0;
let replayPlaying = false;
let replayTimer = null;
let recordingTimer = null;
let diagnosticsTimer = null;
const replayById = (id) => document.getElementById(`dashboardReplay${id}`);
function drawReplay() {
  const recording = recorder.snapshot();
  replayById('Panel').dataset.replayState = recording.status.toLowerCase();
  if (recorder.snapshot().status === 'RECORDING') replayPosition = Math.max(0, recording.frames.length - 1);
  replayView.render(recording, replayPosition, replayPlaying ? `PLAYBACK / ${recording.status}` : recording.status);
  const hasFrames = recording.frames.length > 0;
  replayById('Start').disabled = recording.status === 'RECORDING';
  replayById('Stop').disabled = recording.status !== 'RECORDING';
  replayById('Play').disabled = !hasFrames || recording.status === 'RECORDING';
  replayById('Play').textContent = replayPlaying ? 'Pause' : 'Play';
  replayById('Export').disabled = !hasFrames;
  updateReplayDiagnostics();

}
function updateReplayDiagnostics() {
  const diag = feedDiagnostics.snapshot();
  for (const [name, feed] of [['Depth', diag.depth], ['Trades', diag.trades]]) {
    replayById(`Diagnostics${name}`).textContent = `${name}: ${feed.status} · reconnects ${feed.reconnects} · live ${feed.liveTransitions}${feed.lastError ? ' · last: ' + feed.lastError : ''}`;
  }
  updateWorkspaceDiagnostics();
}
function queueReplayDiagnostics() {
  if (cleanedUp || diagnosticsTimer !== null) return;
  diagnosticsTimer = setTimeout(() => { diagnosticsTimer = null; updateReplayDiagnostics(); }, 1000);
}
function stopReplay() {
  replayPlaying = false;
  if (replayTimer !== null) clearInterval(replayTimer);
  replayTimer = null;
}
function stopRecorder() {
  if (recordingTimer !== null) clearInterval(recordingTimer);
  recordingTimer = null;
  recorder.stop();
  drawReplay();
}
function captureMarketObservation() {
  if (recorder.snapshot().status !== 'RECORDING') return;
  const now = Date.now();
  const at = Math.floor(now / 2000) * 2000;
  const state = latest?.state;
  const recentPriceAt = Math.max(state?.lastTradeAt ?? 0, state?.lastTickerAt ?? 0);
  const priceValid = ['LIVE', 'DEGRADED'].includes(state?.connectionStatus) && Number.isFinite(state?.currentPrice) &&
    state.currentPrice > 0 && recentPriceAt <= now && now - recentPriceAt <= 5_000;
  const depthValid = latestDepth.status === 'LIVE' && latestDepth.book && latestDepth.updatedAt !== null &&
    latestDepth.updatedAt <= now && now - latestDepth.updatedAt <= 3_000;
  let bands = null;
  if (depthValid) {
    const bids = latestDepth.book.bids, asks = latestDepth.book.asks;
    const bid = bids?.size ? Math.max(...bids.keys()) : NaN;
    const ask = asks?.size ? Math.min(...asks.keys()) : NaN;
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid < ask) {
      bands = deriveLiquidityBands(latestDepth.book, (bid + ask) / 2, liquidityPreferences.bucketSize, 12).bands
        .map(({ side, lower, notional }) => ({ side, lower, notional }));
    }
  }
  const flowFresh = latestFlowFeed.status === 'LIVE' && latestFlowFeed.updatedAt !== null &&
    latestFlowFeed.updatedAt <= now && now - latestFlowFeed.updatedAt <= 3_000;
  const flowSnapshot = flowFresh ? flowAccumulator.snapshot(now, latestFlowFeed.status) : null;
  const accepted = recorder.capture({
    at, bucketSize: liquidityPreferences.bucketSize, price: priceValid ? state.currentPrice : null,
    priceStatus: priceValid ? 'LIVE' : 'UNAVAILABLE',
    depthStatus: bands ? 'LIVE' : latestDepth.status === 'LIVE' ? 'UNAVAILABLE' : latestDepth.status,
    flowStatus: flowSnapshot ? 'LIVE' : latestFlowFeed.status === 'LIVE' ? 'UNAVAILABLE' : latestFlowFeed.status,
    bands, flow: flowSnapshot ? { segment: flowSnapshot.segment, count: flowSnapshot.count, cvdBtc: flowSnapshot.cvdBtc,
      deltaBtc: flowSnapshot.deltaBtc, buyBtc: flowSnapshot.buyBtc, sellBtc: flowSnapshot.sellBtc } : null
  });
  if (!accepted && recorder.snapshot().status !== 'RECORDING') {
    stopRecorder(); replayById('Feedback').textContent = 'Recording stopped: capacity reached or price bin changed.';
  }
  drawReplay();
}
function startRecorder() {
  stopReplay();
  if (recordingTimer !== null) clearInterval(recordingTimer);
  recorder.start();
  replayPosition = 0;
  replayById('Feedback').textContent = 'Recording only while dashboard is visible; no storage or background capture.';
  captureMarketObservation();
  recordingTimer = setInterval(() => {
    if (document.visibilityState !== 'visible' || navigator.onLine === false) {
      stopRecorder(); replayById('Feedback').textContent = 'Capture stopped on hidden/offline dashboard; gaps are not backfilled.';
      return;
    }
    captureMarketObservation();
  }, 2_000);
  drawReplay();
}
function playReplay() {
  if (replayPlaying) { stopReplay(); drawReplay(); return; }
  const frames = recorder.snapshot().frames;
  if (!frames.length) return;
  if (replayPosition >= frames.length - 1) replayPosition = 0;
  replayPlaying = true;
  const speed = Number(replayById('Speed').value);
  replayTimer = setInterval(() => {
    replayPosition++;
    if (replayPosition >= recorder.snapshot().frames.length - 1) stopReplay();
    drawReplay();
  }, Math.round(2000 / speed));
  drawReplay();
}
function bindReplay() {
  replayById('Start').addEventListener('click', startRecorder);
  replayById('Stop').addEventListener('click', stopRecorder);
  replayById('Play').addEventListener('click', playReplay);
  replayById('Speed').addEventListener('change', () => { if (replayPlaying) { stopReplay(); playReplay(); } });
  replayById('Position').addEventListener('input', (event) => { stopReplay(); replayPosition = Number(event.target.value); drawReplay(); });
  replayById('Clear').addEventListener('click', () => { stopReplay(); stopRecorder(); recorder.reset(); replayPosition = 0; drawReplay(); });
  replayById('Export').addEventListener('click', () => {
    try {
      const json = recorder.exportJson();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'btc-live-observations.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { replayById('Feedback').textContent = error.message; }
  });
  replayById('Import').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > REPLAY_MAX_BYTES) throw new Error('Recording is larger than 1 MiB');
      const json = await file.text();
      stopReplay(); stopRecorder(); recorder.load(json); replayPosition = 0;
      replayById('Feedback').textContent = 'IMPORTED · Untrusted offline observation samples; never live market data.';
      drawReplay();
    } catch (error) { replayById('Feedback').textContent = `Import rejected: ${error.message}`; }
    finally { event.target.value = ''; }
  });
  drawReplay();
}

let latest = null;
let latestChart = null;
const chartViewport = createChartViewport();
const chartDrawingStore=createDrawingStore();
let chartDrawings=null, chartAlertTargets=[];
let chartTradeMarkers=[];
function drawChart(now=Date.now()) {
  if(!latestChart)return;
  const svg=document.getElementById('dashboardChartSvg');
  const range=chartViewport.range(latestChart.candles.length);
  renderBtcChart(latestChart,latest?.state,now,range);
  const model=getRenderedChartModel(svg);
  chartDrawings?.setModel(model);
  const context=latestDepth.status==='LIVE' && Number.isFinite(latestDepth.updatedAt) && now-latestDepth.updatedAt<3000 && now>=latestDepth.updatedAt
    && latestDepth.book && Number.isFinite(latest?.state?.currentPrice)
      ? deriveLiquidityBands(latestDepth.book,latest.state.currentPrice,liquidityPreferences.bucketSize,4).bands : [];
  renderChartMarketOverlays(svg,model,{alerts:chartAlertTargets,bands:context,trades:chartTradeMarkers,
    showTrades:latestChart.preferences.showTrades && latestFlowFeed.status==='LIVE',
    showAlerts:latestChart.preferences.showAlerts,showLiquidity:latestChart.preferences.showLiquidity,
    live:latestChart.status==='READY' && Number.isFinite(latestChart.lastStreamAt) && now-latestChart.lastStreamAt<8000});
  const history=latestChart.history;
  const historyStatus=document.getElementById('dashboardChartHistoryStatus');
  if(historyStatus)historyStatus.textContent=history?.loading?'Loading older candles…':history?.error??
    (history?.capped?'History limit reached':history?.reachedStart?'Start of available history':`${latestChart.candles.length} candles · UTC`);
  const older=document.getElementById('dashboardChartOlder');
  if(older)older.disabled=!latestChart.candles.length || !!history?.loading || !!history?.reachedStart || !!history?.capped;
}
let liquidityPreferences = { ...DEFAULT_LIQUIDITY_PREFERENCES };
const liquidityView = createLiquidityRenderer();
const depthHistory = createDepthHistory();
const historyView = createLiquidityHistoryRenderer();
let liquidityPaintTimer = null;
let latestDepth = { status: 'IDLE', updatedAt: null, error: '', book: null };
let flowPreferences = { ...DEFAULT_FLOW_PREFERENCES };
let latestFlowFeed = { status: 'IDLE', segment: 0, updatedAt: null, error: '' };
const flowAccumulator = createOrderFlowAccumulator();
const flowView = createOrderFlowRenderer();
let flowPaintTimer = null;
const flowPaint = createRenderScheduler(() => {
  if (workspaceController && !isWorkspaceVisible('analytics')) return;
  const now = Date.now();
  flowView.render(flowAccumulator.snapshot(now, latestFlowFeed.status),
    evaluateLiquidityBehavior(depthHistory.snapshot(), now), flowPreferences.enabled, latestDepth.status,
    evaluateLiquidityPersistence(depthHistory.snapshot(), now));
});
function queueFlowPaint() {
  if (flowPaintTimer !== null || cleanedUp) return;
  flowPaintTimer = setTimeout(() => {
    flowPaintTimer = null;
    flowPaint.schedule();
  }, 180);
}
const flowRuntime = createBinanceAggTradeRuntime({ onChange(feed, trade) {
  if (latestFlowFeed.segment !== feed.segment) {flowAccumulator.reset(feed.segment);chartTradeMarkers=[];}
  latestFlowFeed = feed;
  handleEventFeed('trades', feed.status);
  if (trade) appendMarketEvent('trade', { id: trade.id, segment: feed.segment, eventAt: trade.eventAt, tradeAt: trade.tradeAt,
    side: trade.side, price: trade.price, quantity: trade.quantity });
  feedDiagnostics.ingest('trades', feed);
  queueReplayDiagnostics();
  if (trade) {
    flowAccumulator.ingest(trade, Date.now(), feed.segment);
    const at=Date.now();
    chartTradeMarkers=chartTradeMarkers.filter(item=>at-item.receivedAt>=0 && at-item.receivedAt<60_000);
    if (trade.notional>=100_000) {
      chartTradeMarkers.push({...trade,receivedAt:at});
      chartTradeMarkers=chartTradeMarkers.slice(-24);
    }
  }
  queueFlowPaint();
  observeAdvancedAlerts();
  if(trade && latestChart?.preferences.showTrades && (!workspaceController || isWorkspaceVisible('live')))drawChart();
} });
const liquidityPaint = createRenderScheduler(() => {
  if (workspaceController && !isWorkspaceVisible('analytics')) return;
  const state = latest?.state;
  const reference = ['LIVE', 'DEGRADED'].includes(state?.connectionStatus) ? state?.currentPrice : null;
  liquidityView.render(latestDepth, liquidityPreferences, reference);
  historyView.render(depthHistory.snapshot(), latestDepth, liquidityPreferences.enabled);
});
function queueLiquidityPaint() {
  if (liquidityPaintTimer !== null || cleanedUp) return;
  liquidityPaintTimer = setTimeout(() => {
    liquidityPaintTimer = null;
    liquidityPaint.schedule();
  }, 180);
}
const depthRuntime = createBinanceDepthRuntime({ onEvent(event, at) { appendMarketEvent(event.kind,event,at); }, onChange(snapshot) {
  latestDepth = snapshot;
  handleEventFeed('depth', snapshot.status);
  feedDiagnostics.ingest('depth', snapshot);
  queueReplayDiagnostics();
  depthHistory.ingest(snapshot, liquidityPreferences.bucketSize, Date.now());
  queueLiquidityPaint();
  queueFlowPaint();
  observeAdvancedAlerts();
} });
const api = globalThis.browser ?? globalThis.chrome ?? null;
let workspaceController = null;
let terminalExperience = null;
let disclosureMenus = null;
let chartExpansion = null;
let notificationTest = null;
let replayModeController = null;
function isWorkspaceVisible(view) { return workspaceController?.active() === view; }
function updateWorkspaceDiagnostics() {
  const state = latest?.state;
  document.getElementById('dashboardDiagnosticsPrice').textContent = state?.connectionStatus ?? 'WAITING';
  document.getElementById('dashboardDiagnosticsPriceNote').textContent = state?.lastError ??
    (state?.currentPrice ? 'Last validated price: ' + state.currentPrice.toLocaleString('en-US') + ' USDT' : 'Awaiting validated market data.');
  const snapshot = feedDiagnostics.snapshot();
  for (const [name, feed] of [['Depth', snapshot.depth], ['Trades', snapshot.trades]]) {
    document.getElementById('dashboardDiagnostics' + name).textContent = feed.status;
    document.getElementById('dashboardDiagnostics' + name + 'Note').textContent =
      `Reconnects: ${feed.reconnects} · Live transitions: ${feed.liveTransitions}${feed.lastError ? ' · Last error: ' + feed.lastError : ''}`;
  }
}

let cleanedUp = false;
let chartInteractions = null;
const renderer = createRenderScheduler(() => {
  const now = Date.now();
  if (latest) renderDashboard(latest, now);
  if (latestChart && (!workspaceController || isWorkspaceVisible('live'))) drawChart(now);
});
const notificationManager = createNotificationManager({ source: 'dashboard' });
const advancedAlerts=createAdvancedAlertCenter();
function observeAdvancedAlerts(){
  if (!latest?.settings || !latest?.state) return;
  const now=Date.now();
  advancedAlerts.observe({
    price:latest.state.currentPrice,
    priceValid:['LIVE','DEGRADED'].includes(latest.state.connectionStatus) && Number.isFinite(latest.state.currentPrice) && Number.isFinite(latest.state.lastValidUpdateAt) && now>=latest.state.lastValidUpdateAt && now-latest.state.lastValidUpdateAt<=5000,
    trades:latestFlowFeed,depth:latestDepth,flow:flowAccumulator.snapshot(now,latestFlowFeed.status)
  },latest.settings);
}

const alertCenter = createAlertCenterController({
  ids: {
    form: 'dashboardTargetForm', direction: 'dashboardTargetDirection', price: 'dashboardTargetPrice', label: 'dashboardTargetLabel',
    feedback: 'dashboardTargetFeedback', targetList: 'dashboardTargetList', targetCount: 'dashboardTargetCount',
    historyList: 'dashboardHistoryList', historyCount: 'dashboardHistoryCount', clearHistory: 'dashboardClearHistory', historyFeedback: 'dashboardHistoryFeedback'
  }
});

const chartRuntime = createBtcChartRuntime({
  onChange(snapshot) {
    if (latestChart && latestChart.preferences.interval === snapshot.preferences.interval) {
      chartViewport.preserveAnchor(latestChart.candles, snapshot.candles);
    } else chartViewport.reset(snapshot.candles.length);
    latestChart = snapshot;
    renderer.schedule();
  }
});

const runtime = createBtcLiveRuntime({
  onChange(snapshot) {
    latest = snapshot;
    notificationManager.observe(snapshot);
    observeAdvancedAlerts();
    chartRuntime.ingestMarketState(snapshot.state);
    renderer.schedule();
    queueLiquidityPaint();
    updateWorkspaceDiagnostics();
  }
});

function bindSettings() {
  updatePanelDispose = mountSoftwareUpdates({ container: document.querySelector('[data-workspace-panel="settings"] .settings-panel'), api });
  for (const [id, key] of [
    ['dashboardSettingCompact', 'compactLayout'],
    ['dashboardSettingBidAsk', 'showBidAsk'],
    ['dashboardSettingVolume', 'showVolume'],
    ['dashboardSettingRange', 'showRange'],
    ['dashboardSettingAnimation', 'priceAnimation'],
    ['dashboardSettingNotifications', 'notificationsEnabled'],
    ['dashboardSettingBackgroundAlerts', 'backgroundAlertsEnabled'],
    ['dashboardSettingNotifyPrice', 'notifyPriceMove'],
    ['dashboardSettingNotifyConnection', 'notifyConnectionIssues']
  ]) {
    document.getElementById(id).addEventListener('change', (event) => {
      const settings = latest?.settings ?? DEFAULT_SETTINGS;
      runtime.updateSettings({ ...settings, [key]: event.target.checked });
    });
  }
  document.getElementById('dashboardSettingPriceThreshold').addEventListener('change', (event) => {
    const settings = latest?.settings ?? DEFAULT_SETTINGS;
    runtime.updateSettings({ ...settings, priceMovePercentThreshold: Number(event.target.value) });
  });


  document.getElementById('dashboardSettingNotificationCooldown').addEventListener('change', (event) => {
    const settings = latest?.settings ?? DEFAULT_SETTINGS;
    runtime.updateSettings({ ...settings, notificationCooldownSeconds: Number(event.target.value) });
  });
}

function bindChart() {
  for (const [id, interval] of [
    ['dashboardChartInterval1m', '1m'],
    ['dashboardChartInterval5m', '5m'],
    ['dashboardChartInterval15m', '15m'],
    ['dashboardChartInterval30m', '30m'],
    ['dashboardChartInterval1h', '1h'],
    ['dashboardChartInterval4h', '4h']
  ]) {
    document.getElementById(id).addEventListener('click', () => chartRuntime.updatePreferences({ interval }));
  }

  document.getElementById('dashboardChartCandles').addEventListener('click', () => {
    chartRuntime.updatePreferences({ mode: 'candles' });
  });
  document.getElementById('dashboardChartLine').addEventListener('click', () => {
    chartRuntime.updatePreferences({ mode: 'line' });
  });
  document.getElementById('dashboardChartArea').addEventListener('click', () => {
    chartRuntime.updatePreferences({ mode: 'area' });
  });
  document.getElementById('dashboardChartCandleStyle').addEventListener('change', event => {
    chartRuntime.updatePreferences({candleStyle:event.target.value});
  });
  document.getElementById('dashboardChartHighlightActive').addEventListener('change', event => {
    chartRuntime.updatePreferences({highlightActiveCandle:event.target.checked});
  });
  for(const [id,key] of [['dashboardChartPatterns','showPatterns'],['dashboardChartVolumeIntelligence','showVolumeIntelligence']]) document.getElementById(id).addEventListener('change',e=>chartRuntime.updatePreferences({[key]:e.target.checked}));
  document.getElementById('dashboardChartVolume').addEventListener('change', (event) => {
    chartRuntime.updatePreferences({ showVolume: event.target.checked });
  });
  for (const key of ['ema20','ema50','sma200','show24h','showAlerts','showLiquidity','showTrades']) {
    document.getElementById(`dashboardChart${key}`).addEventListener('change', event => chartRuntime.updatePreferences({[key]:event.target.checked}));
  }
  const total=()=>latestChart?.candles.length??0;
  const redraw=()=>{
    drawChart();
    const range=chartViewport.range(total());
    if(range.start<20 && !range.following && !latestChart?.history?.loading && !latestChart?.history?.reachedStart && !latestChart?.history?.error)
      chartRuntime.loadOlder().catch(error=>console.warn('History load failed',error));
  };
  document.getElementById('dashboardChartZoomIn').addEventListener('click',()=>{chartViewport.zoom(1,total());redraw();});
  document.getElementById('dashboardChartZoomOut').addEventListener('click',()=>{chartViewport.zoom(-1,total());redraw();});
  document.getElementById('dashboardChartReset').addEventListener('click',()=>{chartViewport.reset(total());redraw();});
  document.getElementById('dashboardChartLive').addEventListener('click',()=>{chartViewport.toLive(total());redraw();});
  chartExpansion = createChartExpansion({ redraw: () => drawChart() });
  const svg=document.getElementById('dashboardChartSvg');
  chartInteractions=bindChartInteractions({svg,tooltip:document.getElementById('dashboardChartTooltip'),viewport:chartViewport,count:total,onChange:redraw});
  chartDrawings=bindChartDrawings({svg,store:chartDrawingStore,getInterval:()=>latestChart?.preferences.interval??'5m',onChange:()=>{},
    onWarning:error=>console.warn('Chart annotation error',error)});
  for(const tool of ['inspect','horizontal','trend','measure','zone']) {
    document.getElementById(`dashboardChartDraw${tool}`).addEventListener('click',()=>{
      chartDrawings.selectTool(tool);
      for(const name of ['inspect','horizontal','trend','measure','zone'])
        document.getElementById(`dashboardChartDraw${name}`).setAttribute('aria-pressed',String(name===tool));
    });
  }
  document.getElementById('dashboardChartDrawUndo').addEventListener('click',()=>chartDrawings.undo());
  document.getElementById('dashboardChartDrawRedo').addEventListener('click',()=>chartDrawings.redo());
  document.getElementById('dashboardChartDrawDelete').addEventListener('click',()=>chartDrawings.removeSelected());
  document.getElementById('dashboardChartDrawSave').addEventListener('click',async()=>{
    const button=document.getElementById('dashboardChartDrawSave');
    try{await chartDrawingStore.save();button.textContent='Saved';}
    catch(error){console.warn('Drawings could not be saved',error);button.textContent='Save failed';}
  });
  document.getElementById('dashboardChartOlder').addEventListener('click',()=>{
    chartViewport.pan(110,total());drawChart();
    chartRuntime.loadOlder().catch(error=>console.warn('History load failed',error));
  });
  chartDrawingStore.load().then(()=>drawChart()).catch(error=>console.warn('Chart drawings unavailable',error));
  loadAlertTargets().then(value=>{chartAlertTargets=value;drawChart();}).catch(error=>console.warn('Chart alerts unavailable',error));
  window.addEventListener('resize', drawChart);
  document.getElementById('dashboardChartRetry').addEventListener('click', () => chartRuntime.reload());
}

function shouldStreamTrades() {
  return flowPreferences.enabled && document.visibilityState === 'visible' && navigator.onLine !== false;
}
function applyFlowPreferences(value) {
  flowPreferences = sanitizeFlowPreferences(value);
  document.getElementById('dashboardFlowEnabled').checked = flowPreferences.enabled;
  flowRuntime.setEnabled(shouldStreamTrades());
  latestFlowFeed = flowRuntime.snapshot();
  flowPaint.schedule();
}
function bindFlow() {
  document.getElementById('dashboardFlowEnabled').addEventListener('change', (event) => {
    applyFlowPreferences({ enabled: event.target.checked });
    saveFlowPreferences(flowPreferences).catch((error) => console.warn('BTC Live flow preferences failed to persist', error));
  });
  document.getElementById('dashboardFlowRetry').addEventListener('click', () => flowRuntime.retryNow());
}

function shouldStreamDepth() {
  return liquidityPreferences.enabled && document.visibilityState === 'visible' && navigator.onLine !== false;
}

function applyLiquidityPreferences(value) {
  const next = sanitizeLiquidityPreferences(value);
  if (next.bucketSize !== liquidityPreferences.bucketSize) depthHistory.clear();
  liquidityPreferences = next;
  document.getElementById('dashboardLiquidityEnabled').checked = liquidityPreferences.enabled;
  document.getElementById('dashboardLiquidityBucket').value = String(liquidityPreferences.bucketSize);
  document.getElementById('dashboardLiquidityMode').value = liquidityPreferences.mode;
  depthRuntime.setEnabled(shouldStreamDepth());
  latestDepth = depthRuntime.snapshot();
  liquidityPaint.schedule();
}

function bindLiquidity() {
  for (const [id, key, read] of [
    ['dashboardLiquidityEnabled', 'enabled', (node) => node.checked],
    ['dashboardLiquidityBucket', 'bucketSize', (node) => Number(node.value)],
    ['dashboardLiquidityMode', 'mode', (node) => node.value]
  ]) {
    const node = document.getElementById(id);
    node.addEventListener('change', () => {
      applyLiquidityPreferences({ ...liquidityPreferences, [key]: read(node) });
      saveLiquidityPreferences(liquidityPreferences).catch((error) => console.warn('BTC Live liquidity preferences failed to persist', error));
    });
  }
  document.getElementById('dashboardLiquidityRetry').addEventListener('click', () => depthRuntime.retryNow());
}

function handleStorageChange(changes, areaName) {
  if (areaName !== 'local') return;
  if (changes?.[WORKSPACE_STORAGE_KEY] && workspaceController) workspaceController.sync(sanitizeWorkspace(changes[WORKSPACE_STORAGE_KEY].newValue));
  if (changes?.[SETTINGS_STORAGE_KEY]) {
    runtime.syncSettings(sanitizeSettings(changes[SETTINGS_STORAGE_KEY].newValue));
  }
  if (changes?.[ALERT_TARGETS_STORAGE_KEY]) {
    alertCenter.refreshTargets().catch((error) => console.warn('BTC Live target UI refresh failed', error));
    chartAlertTargets=sanitizeAlertTargets(changes[ALERT_TARGETS_STORAGE_KEY].newValue);drawChart();
  }
  if (changes?.[ALERT_HISTORY_STORAGE_KEY]) alertCenter.refreshHistory().catch((error) => console.warn('BTC Live history UI refresh failed', error));
  if (changes?.[FLOW_PREFERENCES_KEY]) applyFlowPreferences(changes[FLOW_PREFERENCES_KEY].newValue);
  if (changes?.[LIQUIDITY_PREFERENCES_KEY]) {
    applyLiquidityPreferences(changes[LIQUIDITY_PREFERENCES_KEY].newValue);
  }
  if (changes?.[CHART_PREFERENCES_STORAGE_KEY]) {
    chartRuntime.syncPreferences(sanitizeChartPreferences(changes[CHART_PREFERENCES_STORAGE_KEY].newValue));
  }
}

function bindUi() {
  document.getElementById('dashboardRetryButton').addEventListener('click', () => runtime.retryNow());
  document.getElementById('dashboardResetSettings').addEventListener('click', () => runtime.resetSettings());
  bindSettings();
  bindChart();
  bindLiquidity();
  bindFlow();
  bindReplay();
  bindEventReplay();
  replayModeController = createReplayModeController({ onChange(mode) {
    if (workspaceController?.active() !== 'replay') return;
    if (mode === 'samples') drawReplay(); else drawEvents();
  } });
  workspaceController = createWorkspaceController({
    onNavigate(view) {
      if (view !== 'live' && terminalExperience?.focus()) terminalExperience.setFocus(false);
      if (view !== 'live' && chartExpansion?.expanded()) chartExpansion.setExpanded(false);
      if (view === 'analytics') { liquidityPaint.schedule(); flowPaint.schedule(); }
      if (view === 'replay') {
        if (replayModeController.active() === 'samples') drawReplay(); else drawEvents();
      }
      if (view === 'live') renderer.schedule();
      if (view === 'diagnostics') updateWorkspaceDiagnostics();
    },
    onPreferenceChange(value) {
      saveWorkspace(value).catch(error => console.warn('BTC Live workspace preferences failed to persist', error));
    }
  });
  terminalExperience = createTerminalExperience({ navigate: (view) => workspaceController?.navigate(view, { user: true }) ?? false,
    availableViews: () => workspaceController?.available() ?? [], onFocus: () => drawChart() });
  disclosureMenus = bindDisclosureMenus(document);
  loadWorkspace().then(workspace => workspaceController?.restore(workspace))
    .catch(error => console.warn('BTC Live workspace preferences unavailable', error));
  document.getElementById('dashboardDiagnosticsRetryPrice').addEventListener('click', () => runtime.retryNow());
  document.getElementById('dashboardDiagnosticsRetryDepth').addEventListener('click', () => depthRuntime.retryNow());
  document.getElementById('dashboardDiagnosticsRetryTrades').addEventListener('click', () => flowRuntime.retryNow());
  notificationTest = bindNotificationTest({ button: document.getElementById('dashboardTestNotification'), feedback: document.getElementById('dashboardNotificationFeedback') });
  // Background tabs may suspend animation frames; paint the latest state on return.
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  api?.storage?.onChanged?.addListener(handleStorageChange);
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') { stopReplay(); stopEventPlayback(); if (recorder.snapshot().status === 'RECORDING') stopRecorder(); if (eventRecorder.snapshot().status === 'RECORDING') stopEventRecorder(); }
  if (document.visibilityState === 'visible') chartRuntime.handleVisible();
  else chartRuntime.handleHidden();
  flowRuntime.setEnabled(shouldStreamTrades());
  latestFlowFeed = flowRuntime.snapshot();
  flowPaint.schedule();
  depthRuntime.setEnabled(shouldStreamDepth());
  latestDepth = depthRuntime.snapshot();
  if (document.visibilityState === 'visible') renderer.flush();
  liquidityPaint.schedule();
}

function handleOffline() {
  if (recorder.snapshot().status === 'RECORDING') stopRecorder();
  if (eventRecorder.state().status === 'RECORDING') stopEventRecorder();
  stopEventPlayback();
  runtime.handleOffline();
  chartRuntime.handleOffline();
  flowRuntime.setEnabled(false);
  latestFlowFeed = flowRuntime.snapshot();
  flowPaint.schedule();
  depthRuntime.setEnabled(false);
  latestDepth = depthRuntime.snapshot();
  liquidityPaint.schedule();
}

function handleOnline() {
  runtime.handleOnline();
  chartRuntime.handleOnline();
  flowRuntime.setEnabled(shouldStreamTrades());
  latestFlowFeed = flowRuntime.snapshot();
  flowPaint.schedule();
  depthRuntime.setEnabled(shouldStreamDepth());
  latestDepth = depthRuntime.snapshot();
  liquidityPaint.schedule();
}

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  stopReplay();
  stopRecorder();
  stopEventPlayback();
  stopEventRecorder();
  analyticsViews.dispose();
  workspaceController?.dispose();
  replayModeController?.dispose();
  eventView.dispose();
  savedSessions.close();
  if (diagnosticsTimer !== null) clearTimeout(diagnosticsTimer);
  diagnosticsTimer = null;
  replayView.dispose();
  renderer.dispose();
  if (liquidityPaintTimer !== null) clearTimeout(liquidityPaintTimer);
  liquidityPaintTimer = null;
  liquidityPaint.dispose();
  liquidityView.dispose();
  historyView.dispose();
  if (flowPaintTimer !== null) clearTimeout(flowPaintTimer);
  flowPaintTimer = null;
  flowPaint.dispose();
  flowView.dispose();
  flowRuntime.dispose();
  depthRuntime.dispose();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('online', handleOnline);
  api?.storage?.onChanged?.removeListener(handleStorageChange);
  chartDrawings?.dispose();
  terminalExperience?.dispose();
  disclosureMenus?.dispose();
  chartExpansion?.dispose();
  notificationTest?.dispose();
  chartInteractions?.dispose();
  window.removeEventListener('resize', drawChart);
  chartRuntime.dispose();
  alertCenter.dispose();
  notificationManager.dispose();
  runtime.dispose('Dashboard closed');
}

const analyticsViews = bindAnalyticsViews(document, { onChange() {
  liquidityPaint.schedule();
  flowPaint.schedule();
} });
bindUi();
advancedAlerts.initialize().catch(error=>console.warn('Advanced rule initialization failed',error));
alertCenter.refresh().catch((error) => console.warn('BTC Live alert center initialization failed', error));
window.addEventListener('pagehide', cleanup, { once: true });
window.addEventListener('unload', cleanup, { once: true });

loadFlowPreferences().then(applyFlowPreferences).catch((error) => {
  console.warn('BTC Live flow settings unavailable', error);
  applyFlowPreferences(DEFAULT_FLOW_PREFERENCES);
});
loadLiquidityPreferences().then(applyLiquidityPreferences).catch((error) => {
  console.warn('BTC Live liquidity settings unavailable', error);
  applyLiquidityPreferences(DEFAULT_LIQUIDITY_PREFERENCES);
});
Promise.allSettled([runtime.start(), chartRuntime.start()]).then((results) => {
  for (const result of results) {
    if (result.status === 'rejected') console.error('BTC Live dashboard initialization failed', result.reason);
  }
});

window.addEventListener('pagehide', () => updatePanelDispose(), { once: true });
