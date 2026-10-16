import { CHART_STATUS } from '../app/chart-runtime.js';
import { ema, sma } from './chart-math.js';
import { candlePatterns, volumeMetrics } from './candle-intelligence.js';
import { formatPrice, formatVolume } from '../utils/format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const renderedChartKeys = new WeakMap();
const renderedModels = new WeakMap();
const renderedChartModes = new WeakMap();
const renderCounters = new WeakMap();
export function getChartRenderCounters(svg) { return { ...(renderCounters.get(svg) ?? { full: 0, incremental: 0 }) }; }
const chartRedrawListeners = new WeakMap();
export function subscribeChartRedraw(svg, listener) {
  if (typeof listener !== 'function') throw new TypeError('listener must be a function');
  chartRedrawListeners.set(svg, listener);
  return () => { if (chartRedrawListeners.get(svg) === listener) chartRedrawListeners.delete(svg); };
}
export function getRenderedChartModel(svg) { return renderedModels.get(svg) ?? null; }
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 360;
const PADDING = Object.freeze({ left: 8, right: 82, top: 18, bottom: 22 });

export function buildChartModel(candles, {
  showVolume = true,
  currentPrice = null,
  open24h = null,
  high24h = null,
  low24h = null,
  view = null,
  indicators = {},
  show24h = true,
  canvasWidth = VIEW_WIDTH,
  candleStyle = 'classic',
  highlightActiveCandle = true,
  showPatterns = false,
  showVolumeIntelligence = false
} = {}) {
  const all = Array.isArray(candles)
    ? candles.filter((candle) => candle && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
      candle.low > 0 && candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close))
    : [];
  const viewStart = Math.max(0, Math.min(view?.start ?? 0, all.length));
  const viewEnd = Math.max(viewStart, Math.min(view?.end ?? all.length, all.length));
  const valid = all.slice(viewStart, viewEnd);
  if (!valid.length) return null;

  const priceBottom = showVolume ? 274 : VIEW_HEIGHT - PADDING.bottom;
  const volumeTop = showVolume ? 292 : priceBottom;
  const volumeBottom = VIEW_HEIGHT - PADDING.bottom;
  const chartWidth = Number.isFinite(canvasWidth) ? Math.max(340, Math.min(VIEW_WIDTH, Math.round(canvasWidth))) : VIEW_WIDTH;
  const plotLeft = PADDING.left;
  const plotRight = chartWidth - PADDING.right;
  const plotWidth = plotRight - plotLeft;
  const priceHeight = priceBottom - PADDING.top;
  const lows = valid.map((candle) => candle.low);
  const highs = valid.map((candle) => candle.high);
  // A present-day trade price must not compress a manually inspected historical range.
  const following = view?.following !== false;
  if (following && Number.isFinite(currentPrice) && currentPrice > 0) {
    lows.push(currentPrice);
    highs.push(currentPrice);
  }
  let minPrice = Math.min(...lows);
  let maxPrice = Math.max(...highs);
  const rawSpan = maxPrice - minPrice;
  const padding = rawSpan > 0 ? rawSpan * 0.08 : Math.max(maxPrice * 0.002, 1);
  minPrice -= padding;
  maxPrice += padding;
  const priceSpan = maxPrice - minPrice;
  const maxVolume = Math.max(1, ...valid.map((candle) => Number.isFinite(candle.volume) ? candle.volume : 0));
  const slot = plotWidth / valid.length;
  const bodyWidth = Math.max(0.8, Math.min(candleStyle === 'minimal' ? 5 : 10, slot * (candleStyle === 'minimal' ? 0.38 : 0.62)));

  const xForIndex = (index) => plotLeft + slot * index + slot / 2;
  const yForPrice = (price) => PADDING.top + ((maxPrice - price) / priceSpan) * priceHeight;
  const yForVolume = (volume) => volumeBottom - (Math.max(0, volume) / maxVolume) * (volumeBottom - volumeTop);

  const priceTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = maxPrice - priceSpan * ratio;
    return { value, y: PADDING.top + priceHeight * ratio };
  });
  const multiDay = Math.floor(valid.at(-1).openTime / 86_400_000) !==
    Math.floor(valid[0].openTime / 86_400_000);
  const maxTicks = chartWidth < 480 ? 2 : multiDay ? 3 : 4;
  const tickCount = Math.min(maxTicks, valid.length);
  const xTickIndexes = Array.from({length: tickCount}, (_, index) =>
    tickCount === 1 ? 0 : Math.round(index * (valid.length - 1) / (tickCount - 1)));
  const timeTicks = xTickIndexes.map((index) => ({
    index,
    x: xForIndex(index),
    value: valid[index].openTime
  }));

  const modelCandles = valid.map((candle, index) => {
    const x = xForIndex(index);
    const openY = yForPrice(candle.open);
    const closeY = yForPrice(candle.close);
    const trueBodyHeight = Math.abs(closeY - openY);
    const isDoji = trueBodyHeight < 0.8;
    const visibleBodyHeight = Math.max(isDoji ? 1 : 0.8, trueBodyHeight);
    const visibleBodyY = Math.max(PADDING.top, Math.min(priceBottom - visibleBodyHeight,
      Math.min(openY, closeY) - (visibleBodyHeight - trueBodyHeight) / 2));
    return {
      ...candle,
      x,
      isDoji,
      wickTop: yForPrice(candle.high),
      wickBottom: yForPrice(candle.low),
      bodyY: visibleBodyY,
      bodyHeight: visibleBodyHeight,
      bodyWidth,
      patterns: showPatterns ? candlePatterns(all, viewStart + index) : [],
      volumeMetrics: showVolumeIntelligence ? volumeMetrics(all, viewStart + index) : null,
      direction: candle.close > candle.open ? 'up' : candle.close < candle.open ? 'down' : 'flat',
      volumeY: Number.isFinite(candle.volume) && candle.volume >= 0 ? yForVolume(candle.volume) : volumeBottom,
      volumeHeight: Number.isFinite(candle.volume) && candle.volume >= 0 ? Math.max(0, volumeBottom - yForVolume(candle.volume)) : 0
    };
  });

  const linePoints = modelCandles.map((candle) => `${candle.x.toFixed(2)},${yForPrice(candle.close).toFixed(2)}`).join(' ');
  const referenceLevels = [
    { key: 'current', label: 'LIVE', value: following ? currentPrice : null },
    { key: 'high24h', label: '24H H', value: show24h && following ? high24h : null },
    { key: 'open24h', label: '24H O', value: show24h && following ? open24h : null },
    { key: 'low24h', label: '24H L', value: show24h && following ? low24h : null }
  ].filter((level) => Number.isFinite(level.value) && level.value > 0).map((level) => ({
    ...level,
    inRange: level.value >= minPrice && level.value <= maxPrice,
    y: yForPrice(level.value)
  }));

  return {
    width: chartWidth,
    height: VIEW_HEIGHT,
    plotLeft,
    plotRight,
    priceTop: PADDING.top,
    priceBottom,
    volumeTop,
    volumeBottom,
    showVolume,
    candleStyle,
    highlightActiveCandle,
    showPatterns,
    showVolumeIntelligence,
    candles: modelCandles,
    linePoints,
    priceTicks,
    timeTicks,
    referenceLevels,
    minPrice,
    maxPrice,
    slot,
    viewStart,
    following,
    multiDay,
    yForPrice,
    priceForY: (y) => maxPrice - (y-PADDING.top)/priceHeight*priceSpan,
    indicators: Object.entries(indicators).filter(([,enabled])=>enabled).map(([key]) => {
      const values = key==='ema20' ? ema(all,20) : key==='ema50' ? ema(all,50) : key==='sma200' ? sma(all,200) : [];
      return {key, points: values.slice(viewStart,viewEnd).map((value,index) => value===null ? null : {x:xForIndex(index), y:yForPrice(value)} )};
    })
  };
}

export function renderBtcChart(chartSnapshot, marketState, now = Date.now(), view = null) {
  const { preferences, candles, status, errorMessage, lastLoadedAt } = chartSnapshot;
  setPressed('dashboardChartInterval1m', preferences.interval === '1m');
  setPressed('dashboardChartInterval5m', preferences.interval === '5m');
  setPressed('dashboardChartInterval15m', preferences.interval === '15m');
  for (const v of ['30m','1h','4h']) setPressed(`dashboardChartInterval${v}`, preferences.interval === v);
  setPressed('dashboardChartCandles', preferences.mode === 'candles');
  setPressed('dashboardChartLine', preferences.mode === 'line');
  setPressed('dashboardChartArea', preferences.mode === 'area');
  const styleControl=document.getElementById('dashboardChartCandleStyle');
  if(styleControl) styleControl.value=preferences.candleStyle || 'classic';
  for (const [id,key] of [['dashboardChartPatterns','showPatterns'],['dashboardChartVolumeIntelligence','showVolumeIntelligence']]) { const control=document.getElementById(id); if(control) control.checked=preferences[key]===true; }
  const highlightControl=document.getElementById('dashboardChartHighlightActive');
  if(highlightControl) highlightControl.checked=preferences.highlightActiveCandle !== false;
  document.getElementById('dashboardChartVolume').checked = preferences.showVolume;
  for (const key of ['ema20','ema50','sma200','show24h','showAlerts','showLiquidity','showTrades']) document.getElementById(`dashboardChart${key}`).checked = preferences[key];

  const statusNode = document.getElementById('dashboardChartStatus');
  statusNode.dataset.state = status.toLowerCase();
  statusNode.textContent = chartStatusLabel(status, errorMessage, lastLoadedAt, now, chartSnapshot.lastStreamAt);
  const modeStatus = document.getElementById('dashboardChartViewStatus');
  if (modeStatus) modeStatus.textContent = view?.following === false ? 'HISTORICAL VIEW · Return Live to follow BTCUSDT' : 'FOLLOWING LIVE';
  const retry = document.getElementById('dashboardChartRetry');
  retry.hidden = status !== CHART_STATUS.ERROR;

  renderLevelStrip(marketState);

  const svg = document.getElementById('dashboardChartSvg');
  const chartStage = svg.parentElement?.classList?.contains('chart-stage') ? svg.parentElement : null;
  const stageRect = chartStage?.getBoundingClientRect?.();
  // Match narrow chart containers without relying on SVG intrinsic sizing,
  // which itself can change after viewBox assignment.
  const canvasWidth = Number.isFinite(stageRect?.width) && stageRect.width > 0 && stageRect.width < 560
    ? Math.max(340, Math.round(VIEW_HEIGHT * stageRect.width / Math.max(stageRect.height || 1, 1)))
    : VIEW_WIDTH;
  // Current-market levels are meaningful only on a chart that follows live candles.
  // Excluding them from historical-view geometry also avoids redraws on unrelated trades.
  const following = view?.following !== false;
  const currentPrice = following ? marketState?.currentPrice : null;
  const open24h = following ? marketState?.open24h : null;
  const high24h = following ? marketState?.high24h : null;
  const low24h = following ? marketState?.low24h : null;
  const chartKey = JSON.stringify([
    canvasWidth, preferences.interval, preferences.mode, preferences.candleStyle, preferences.highlightActiveCandle, preferences.showPatterns, preferences.showVolumeIntelligence, preferences.showVolume, preferences.ema20, preferences.ema50, preferences.sma200, preferences.show24h, view?.start, view?.end,
    currentPrice, open24h, high24h, low24h,
    Array.isArray(candles) ? candles.map((candle) => candle ?
      [candle.openTime, candle.open, candle.high, candle.low, candle.close, candle.volume] : null) : null,
    Array.isArray(candles) && candles.some((candle) => candle &&
      [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) ? null : status
  ]);
  // Status, controls and level labels above still refresh when SVG geometry is unchanged.
  if (renderedChartKeys.get(svg) === chartKey) return;
  const model = buildChartModel(candles, {
    showVolume: preferences.showVolume,
    currentPrice,
    open24h,
    high24h,
    low24h,
    view,
    indicators: {ema20:preferences.ema20,ema50:preferences.ema50,sma200:preferences.sma200},
    show24h: preferences.show24h,
    canvasWidth,
    candleStyle: preferences.candleStyle,
    highlightActiveCandle: preferences.highlightActiveCandle,
    showPatterns: preferences.showPatterns,
    showVolumeIntelligence: preferences.showVolumeIntelligence
  });

  const previous = renderedModels.get(svg);
  // Pure pattern-visibility changes do not invalidate candle, indicator, volume,
  // reference or axis geometry.  Rebuild only the small marker layer.
  if (canUpdatePatternLayer(previous, model, preferences, renderedChartModes.get(svg))) {
    const existing = svg.querySelector?.('.chart-pattern-markers');
    if (existing) existing.remove?.();
    else if (previous.showPatterns) {
      // A non-standard DOM implementation cannot safely detach this layer.
      // Use the established full-render fallback rather than duplicate nodes.
    }
    if (!previous.showPatterns || existing?.remove) {
      if (model.showPatterns) renderPatternMarkers(svg, model);
      renderedModels.set(svg, model);
      renderedChartKeys.set(svg, chartKey);
      const stats = renderCounters.get(svg) ?? { full: 0, incremental: 0 };
      stats.incremental++;
      renderCounters.set(svg, stats);
      chartRedrawListeners.get(svg)?.(model);
      return;
    }
  }
  if (canUpdateActiveCandle(previous, model, preferences, renderedChartModes.get(svg))) {
    const candleGroup = svg.querySelector?.('.chart-candles');
    const volumeGroup = svg.querySelector?.('.chart-volume');
    const active = model.candles.at(-1);
    const indicatorGroup = svg.querySelector?.('.chart-indicators');
    const indicatorSegments = indicatorGroup?.children ?? [];
    const indicatorUpdates = indicatorPatch(previous, model, indicatorSegments);
    const levelsGroup = svg.querySelector?.('.chart-levels');
    const referencesChanged = JSON.stringify(previous.referenceLevels) !== JSON.stringify(model.referenceLevels);
    const axis = svg.querySelector?.('.chart-axis');
    const volumeLabel = Array.from(axis?.children ?? []).find(node => node.getAttribute?.('class') === 'chart-volume-label');

    const wick = candleGroup?.lastElementChild?.previousElementSibling;
    const body = candleGroup?.lastElementChild;
    const bar = volumeGroup?.lastElementChild;
    if (wick && body && (!model.showVolume || bar) && indicatorUpdates && (!referencesChanged || levelsGroup)) {
      wick.setAttribute('y1', active.wickTop);
      wick.setAttribute('y2', active.wickBottom);
      body.setAttribute('y', active.bodyY);
      body.setAttribute('height', active.bodyHeight);
      body.setAttribute('class', candleClasses(active, model));
      wick.setAttribute('class', `chart-candle chart-candle-${active.direction} chart-style-${model.candleStyle} chart-wick`);
      if (bar) {
        bar.setAttribute('y', active.volumeY);
        bar.setAttribute('height', active.volumeHeight);
        bar.setAttribute('class', `chart-volume-bar chart-volume-${active.direction}`);
      }
      // Only affected indicator endpoints and live-reference lines are patched;
      // candle nodes and other chart layers preserve DOM identity.
      for (const [node, points] of indicatorUpdates) node.setAttribute('points', points);
      if (referencesChanged) updateReferences(levelsGroup, model);
      if (volumeLabel && Number.isFinite(active.volume)) volumeLabel.textContent = `VOL ${formatVolume(active.volume)}`;
      renderedModels.set(svg, model);
      renderedChartKeys.set(svg, chartKey);
      const stats = renderCounters.get(svg) ?? { full: 0, incremental: 0 };
      stats.incremental++;
      renderCounters.set(svg, stats);
      chartRedrawListeners.get(svg)?.(model);
      return;
    }
  }
  svg.replaceChildren();
  const stats = renderCounters.get(svg) ?? { full: 0, incremental: 0 };
  stats.full++;
  renderCounters.set(svg, stats);
  renderedChartModes.set(svg, preferences.mode);
  const inspector = document.getElementById('dashboardChartTooltip');
  if (inspector) inspector.hidden = true;
  renderedModels.set(svg,model);
  if (!model) {
    const emptyLabel = status === CHART_STATUS.ERROR ? 'Chart unavailable'
      : status === CHART_STATUS.OFFLINE ? 'Offline · no candle data'
      : status === CHART_STATUS.PAUSED ? 'Chart paused' : 'Loading chart...';
    svg.setAttribute('aria-label', status === CHART_STATUS.ERROR ? 'Bitcoin chart unavailable'
      : status === CHART_STATUS.OFFLINE ? 'Bitcoin chart offline · no candle data'
      : status === CHART_STATUS.PAUSED ? 'Bitcoin chart paused' : 'Bitcoin chart loading');
    renderEmpty(svg, emptyLabel, canvasWidth);
    renderedChartKeys.set(svg, chartKey);
    chartRedrawListeners.get(svg)?.(null);
    return;
  }

  svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`);
  svg.setAttribute('aria-label', `BTCUSDT ${preferences.interval} ${preferences.mode} chart with ${model.candles.length} candles`);
  renderGrid(svg, model);
  renderReferences(svg, model);
  if (preferences.mode === 'line') renderLine(svg, model);
  else if (preferences.mode === 'area') renderArea(svg, model);
  else renderCandles(svg, model);
  if (preferences.showVolume) renderVolume(svg, model);
  if (model.showPatterns) renderPatternMarkers(svg, model);
  renderIndicators(svg, model);
  renderAxes(svg, model);
  renderedChartKeys.set(svg, chartKey);
  chartRedrawListeners.get(svg)?.(model);
}

function renderIndicators(svg, model) {
  // Indicators outside the visible candle scale should not paint on axes, volume, or toolbar.
  const defs = svgNode('defs');
  const clip = svgNode('clipPath', {id:'btc-chart-price-clip'});
  clip.append(svgNode('rect', {x:model.plotLeft, y:model.priceTop,
    width:model.plotRight-model.plotLeft, height:model.priceBottom-model.priceTop}));
  defs.append(clip);svg.append(defs);
  const group = svgNode('g', {class:'chart-indicators', 'clip-path':'url(#btc-chart-price-clip)'});
  for (const indicator of model.indicators) {
    let run = [];
    const flush = () => {if (run.length>1) group.append(svgNode('polyline',{
      points:run.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
      fill:'none',class:`chart-indicator chart-indicator-${indicator.key}`
    }));run=[];};
    for (const point of indicator.points) {
      if (!point) {flush();continue;}
      run.push(point);
    }
    flush();
  }
  svg.append(group);
}

function renderLevelStrip(state) {
  document.getElementById('dashboardChartLevelCurrent').textContent = formatPrice(state?.currentPrice);
  document.getElementById('dashboardChartLevelOpen').textContent = formatPrice(state?.open24h);
  document.getElementById('dashboardChartLevelHigh').textContent = formatPrice(state?.high24h);
  document.getElementById('dashboardChartLevelLow').textContent = formatPrice(state?.low24h);
}

function renderGrid(svg, model) {
  const group = svgNode('g', { class: 'chart-grid' });
  for (const tick of model.priceTicks) {
    group.append(svgNode('line', { x1: model.plotLeft, y1: tick.y, x2: model.plotRight, y2: tick.y }));
  }
  svg.append(group);
}

function renderReferences(svg, model) {
  const group = svgNode('g', { class: 'chart-levels' });
  for (const level of model.referenceLevels) {
    if (!level.inRange) continue;
    const line = svgNode('line', {
      x1: model.plotLeft,
      y1: level.y,
      x2: model.plotRight,
      y2: level.y,
      class: `chart-level chart-level-${level.key}`
    });
    group.append(line);
    group.append(svgText(model.plotRight + 7, level.y + 3, level.label, `chart-level-label chart-level-label-${level.key}`));
  }
  svg.append(group);
}

function candleClasses(candle, model) {
  const active = candle.closed === false && model.highlightActiveCandle;
  return `chart-candle chart-candle-${candle.direction} chart-style-${model.candleStyle} chart-body${candle.isDoji ? ' chart-doji' : ''}${active ? ' chart-active-candle' : ''}${candle.closed === false ? ' chart-incomplete' : ''}`;
}

function canUpdatePatternLayer(previous, next, preferences, renderedMode) {
  if (!previous || !next || preferences.mode !== renderedMode ||
      previous.showPatterns === next.showPatterns ||
      previous.width !== next.width || previous.minPrice !== next.minPrice ||
      previous.maxPrice !== next.maxPrice || previous.viewStart !== next.viewStart ||
      previous.slot !== next.slot || previous.candleStyle !== next.candleStyle ||
      previous.showVolume !== next.showVolume ||
      previous.showVolumeIntelligence !== next.showVolumeIntelligence ||
      previous.highlightActiveCandle !== next.highlightActiveCandle ||
      previous.following !== next.following ||
      previous.candles.length !== next.candles.length ||
      JSON.stringify(previous.referenceLevels) !== JSON.stringify(next.referenceLevels)) return false;
  if (previous.indicators.length !== next.indicators.length ||
      previous.indicators.some((item, i) => item.key !== next.indicators[i].key ||
      JSON.stringify(item.points) !== JSON.stringify(next.indicators[i].points))) return false;
  return previous.candles.every((item, i) => {
    const other = next.candles[i];
    return item.openTime === other.openTime && item.open === other.open &&
      item.high === other.high && item.low === other.low &&
      item.close === other.close && item.volume === other.volume &&
      item.closed === other.closed;
  });
}

function canUpdateActiveCandle(previous, next, preferences, renderedMode) {
  if (!previous || !next || preferences.mode !== 'candles' || renderedMode !== 'candles') return false;
  if (preferences.showPatterns) return false;
  if (previous.width !== next.width || previous.candles.length !== next.candles.length || previous.candles.length < 2 ||
    previous.minPrice !== next.minPrice || previous.maxPrice !== next.maxPrice || previous.slot !== next.slot ||
    previous.showVolume !== next.showVolume || previous.candleStyle !== next.candleStyle ||
    previous.highlightActiveCandle !== next.highlightActiveCandle || previous.viewStart !== next.viewStart ||
    previous.following !== next.following) return false;

  const a = previous.candles, b = next.candles;
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i].openTime !== b[i].openTime || a[i].open !== b[i].open || a[i].high !== b[i].high ||
      a[i].low !== b[i].low || a[i].close !== b[i].close || a[i].volume !== b[i].volume || a[i].closed !== b[i].closed) return false;
  }
  return a.at(-1).openTime === b.at(-1).openTime && a.at(-1).open === b.at(-1).open &&
    a.at(-1).closed === false && b.at(-1).closed === false;
}

// Reuse indicator paths when historical points are unchanged. All segments must
// already exist in the same order; otherwise the caller must fully rebuild.
function indicatorPatch(previous, next, nodes) {
  const old = previous.indicators;
  const current = next.indicators;
  if (old.length !== current.length) return null;
  const changes = [];
  let index = 0;
  for (let i = 0; i < current.length; i++) {
    if (old[i].key !== current[i].key || old[i].points.length !== current[i].points.length) return null;
    const oldPoints = old[i].points;
    const nextPoints = current[i].points;
    for (let j = 0; j < oldPoints.length - 1; j++) {
      if (JSON.stringify(oldPoints[j]) !== JSON.stringify(nextPoints[j])) return null;
    }
    // Splitting on unavailable indicator values matches renderIndicators' runs.
    const runs = [];
    let run = [];
    for (const point of nextPoints) {
      if (point) run.push(point);
      else { if (run.length > 1) runs.push(run); run = []; }
    }
    if (run.length > 1) runs.push(run);
    for (const points of runs) {
      const node = nodes[index++];
      if (!node || node.getAttribute?.('class') !== `chart-indicator chart-indicator-${current[i].key}`) return null;
      changes.push([node, points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')]);
    }
  }
  if (index !== nodes.length) return null;
  return changes;
}

function updateReferences(group, model) {
  group.replaceChildren();
  for (const level of model.referenceLevels) {
    if (!level.inRange) continue;
    group.append(svgNode('line', {x1:model.plotLeft,y1:level.y,x2:model.plotRight,y2:level.y,class:`chart-level chart-level-${level.key}`}));
    group.append(svgText(model.plotRight + 7,level.y + 3,level.label,`chart-level-label chart-level-label-${level.key}`));
  }
}

function renderCandles(svg, model) {
  const group = svgNode('g', { class: 'chart-candles' });
  for (const candle of model.candles) {
    const className = `chart-candle chart-candle-${candle.direction}`;
    const active = candle.closed === false && model.highlightActiveCandle;
    const styleClass = `chart-style-${model.candleStyle}`;
    group.append(svgNode('line', {
      x1: candle.x,
      y1: candle.wickTop,
      x2: candle.x,
      y2: candle.wickBottom,
      class: `${className} ${styleClass} chart-wick`
    }));
    group.append(svgNode('rect', {
      x: candle.x - candle.bodyWidth / 2,
      y: candle.bodyY,
      width: candle.bodyWidth,
      height: candle.bodyHeight,
      rx: 0.8,
      class: candleClasses(candle, model)
    }));
  }
  svg.append(group);
}

function renderPatternMarkers(svg,model) {
  const group=svgNode('g',{class:'chart-pattern-markers','aria-label':'Closed candle patterns'});
  for(const candle of model.candles) {
    if(!candle.patterns?.length) continue;
    const marker=svgNode('circle',{cx:candle.x,cy:Math.max(model.priceTop+4,candle.wickTop-6),r:3,class:'chart-pattern-marker'});
    marker.append(svgNode('title'));
    marker.firstChild.textContent=candle.patterns.join(', ');
    group.append(marker);
  }
  svg.append(group);
}

function renderLine(svg, model) {
  svg.append(svgNode('polyline', {
    points: model.linePoints,
    class: 'chart-price-line',
    fill: 'none'
  }));
}

function renderArea(svg, model) {
  // Exchange closes only; SVG fill is presentation and never an interpolated trade series.
  const baseline = model.priceBottom;
  const first = model.candles[0];
  const last = model.candles.at(-1);
  const polygon = `${first.x.toFixed(2)},${baseline.toFixed(2)} ${model.linePoints} ${last.x.toFixed(2)},${baseline.toFixed(2)}`;
  svg.append(svgNode('polygon', {points:polygon, class:'chart-area-fill'}));
  renderLine(svg, model);
}

function renderVolume(svg, model) {
  const group = svgNode('g', { class: 'chart-volume' });
  for (const candle of model.candles) {
    group.append(svgNode('rect', {
      x: candle.x - candle.bodyWidth / 2,
      y: candle.volumeY,
      width: candle.bodyWidth,
      height: candle.volumeHeight,
      class: `chart-volume-bar chart-volume-${candle.direction}`
    }));
  }
  svg.append(group);
}

function renderAxes(svg, model) {
  const group = svgNode('g', { class: 'chart-axis' });
  for (const tick of model.priceTicks) {
    group.append(svgText(model.plotRight + 7, tick.y + 3, formatAxisPrice(tick.value), 'chart-axis-label'));
  }
  for (const tick of model.timeTicks) {
    group.append(svgText(tick.x, model.height - 5, formatChartTime(tick.value, model.multiDay), 'chart-time-label', { anchor: tick.index === 0 ? 'start' : tick.index === model.candles.length - 1 ? 'end' : 'middle' }));
  }
  if (model.showVolume) {
    const latestVolume = model.candles.at(-1)?.volume;
    if (Number.isFinite(latestVolume)) group.append(svgText(model.plotLeft, model.volumeTop + 11, `VOL ${formatVolume(latestVolume)}`, 'chart-volume-label'));
  }
  svg.append(group);
}

function renderEmpty(svg, label, canvasWidth) {
  svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${VIEW_HEIGHT}`);
  svg.append(svgText(canvasWidth / 2, VIEW_HEIGHT / 2, label, 'chart-empty-label', { anchor: 'middle' }));
}

function chartStatusLabel(status, errorMessage, lastLoadedAt, now, lastStreamAt) {
  if (status === CHART_STATUS.ERROR) return errorMessage || 'Chart unavailable';
  if (status === CHART_STATUS.LOADING) return 'LOADING · Binance Futures OHLCV';
  if (status === CHART_STATUS.READY) {
    if (Number.isFinite(lastStreamAt) && now-lastStreamAt < 8_000) return 'LIVE · Futures Kline WebSocket';
    return 'STALE · Kline stream delayed';
  }
  if (status === CHART_STATUS.SYNCING) return 'SYNCING · REST snapshot / stream pending';
  if (status === CHART_STATUS.PAUSED) return 'PAUSED · chart feed suspended while hidden';
  if (status === CHART_STATUS.RECONNECTING) return 'RECONNECTING · Kline stream';
  if (status === CHART_STATUS.STALE) return 'STALE · last exchange candles';
  if (status === CHART_STATUS.OFFLINE) return 'OFFLINE · historical data only';
  return 'Waiting';
}

function setPressed(id, pressed) {
  const node = document.getElementById(id);
  node.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  node.dataset.active = pressed ? 'true' : 'false';
}

function formatAxisPrice(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(value >= 100_000 ? 1 : 2)}k`;
  return `$${value.toFixed(2)}`;
}

export function formatChartTime(timestamp, multiDay = false) {
  if (!Number.isFinite(timestamp)) return '—';
  const value = new Date(timestamp);
  if (!Number.isFinite(value.getTime())) return '—';
  const iso = value.toISOString();
  return multiDay ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : iso.slice(11, 16);
}

function svgNode(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function svgText(x, y, text, className, { anchor = 'start' } = {}) {
  const node = svgNode('text', { x, y, class: className, 'text-anchor': anchor });
  node.textContent = text;
  return node;
}
