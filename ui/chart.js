import { CHART_STATUS } from '../app/chart-runtime.js';
import { formatPrice, formatVolume } from '../utils/format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 360;
const PADDING = Object.freeze({ left: 8, right: 82, top: 18, bottom: 22 });

export function buildChartModel(candles, {
  showVolume = true,
  currentPrice = null,
  open24h = null,
  high24h = null,
  low24h = null
} = {}) {
  const valid = Array.isArray(candles)
    ? candles.filter((candle) => candle && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
    : [];
  if (!valid.length) return null;

  const priceBottom = showVolume ? 274 : VIEW_HEIGHT - PADDING.bottom;
  const volumeTop = showVolume ? 292 : priceBottom;
  const volumeBottom = VIEW_HEIGHT - PADDING.bottom;
  const plotLeft = PADDING.left;
  const plotRight = VIEW_WIDTH - PADDING.right;
  const plotWidth = plotRight - plotLeft;
  const priceHeight = priceBottom - PADDING.top;
  const lows = valid.map((candle) => candle.low);
  const highs = valid.map((candle) => candle.high);
  if (Number.isFinite(currentPrice)) {
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
  const bodyWidth = Math.max(1.5, Math.min(8, slot * 0.58));

  const xForIndex = (index) => plotLeft + slot * index + slot / 2;
  const yForPrice = (price) => PADDING.top + ((maxPrice - price) / priceSpan) * priceHeight;
  const yForVolume = (volume) => volumeBottom - (Math.max(0, volume) / maxVolume) * (volumeBottom - volumeTop);

  const priceTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = maxPrice - priceSpan * ratio;
    return { value, y: PADDING.top + priceHeight * ratio };
  });
  const xTickIndexes = [...new Set([0, Math.floor((valid.length - 1) / 3), Math.floor((valid.length - 1) * 2 / 3), valid.length - 1])];
  const timeTicks = xTickIndexes.map((index) => ({
    index,
    x: xForIndex(index),
    value: valid[index].openTime
  }));

  const modelCandles = valid.map((candle, index) => {
    const x = xForIndex(index);
    const openY = yForPrice(candle.open);
    const closeY = yForPrice(candle.close);
    return {
      ...candle,
      x,
      wickTop: yForPrice(candle.high),
      wickBottom: yForPrice(candle.low),
      bodyY: Math.min(openY, closeY),
      bodyHeight: Math.max(1.2, Math.abs(closeY - openY)),
      bodyWidth,
      direction: candle.close > candle.open ? 'up' : candle.close < candle.open ? 'down' : 'flat',
      volumeY: yForVolume(candle.volume),
      volumeHeight: Math.max(0, volumeBottom - yForVolume(candle.volume))
    };
  });

  const linePoints = modelCandles.map((candle) => `${candle.x.toFixed(2)},${yForPrice(candle.close).toFixed(2)}`).join(' ');
  const referenceLevels = [
    { key: 'current', label: 'LIVE', value: currentPrice },
    { key: 'high24h', label: '24H H', value: high24h },
    { key: 'open24h', label: '24H O', value: open24h },
    { key: 'low24h', label: '24H L', value: low24h }
  ].filter((level) => Number.isFinite(level.value)).map((level) => ({
    ...level,
    inRange: level.value >= minPrice && level.value <= maxPrice,
    y: Math.max(PADDING.top, Math.min(priceBottom, yForPrice(level.value)))
  }));

  return {
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    plotLeft,
    plotRight,
    priceTop: PADDING.top,
    priceBottom,
    volumeTop,
    volumeBottom,
    showVolume,
    candles: modelCandles,
    linePoints,
    priceTicks,
    timeTicks,
    referenceLevels,
    minPrice,
    maxPrice
  };
}

export function renderBtcChart(chartSnapshot, marketState, now = Date.now()) {
  const { preferences, candles, status, errorMessage, lastLoadedAt } = chartSnapshot;
  setPressed('dashboardChartInterval1m', preferences.interval === '1m');
  setPressed('dashboardChartInterval5m', preferences.interval === '5m');
  setPressed('dashboardChartInterval15m', preferences.interval === '15m');
  setPressed('dashboardChartCandles', preferences.mode === 'candles');
  setPressed('dashboardChartLine', preferences.mode === 'line');
  document.getElementById('dashboardChartVolume').checked = preferences.showVolume;

  const statusNode = document.getElementById('dashboardChartStatus');
  statusNode.dataset.state = status.toLowerCase();
  statusNode.textContent = chartStatusLabel(status, errorMessage, lastLoadedAt, now);
  const retry = document.getElementById('dashboardChartRetry');
  retry.hidden = status !== CHART_STATUS.ERROR;

  renderLevelStrip(marketState);

  const svg = document.getElementById('dashboardChartSvg');
  svg.replaceChildren();
  const model = buildChartModel(candles, {
    showVolume: preferences.showVolume,
    currentPrice: marketState?.currentPrice,
    open24h: marketState?.open24h,
    high24h: marketState?.high24h,
    low24h: marketState?.low24h
  });

  if (!model) {
    svg.setAttribute('aria-label', status === CHART_STATUS.ERROR ? 'Bitcoin chart unavailable' : 'Bitcoin chart loading');
    renderEmpty(svg, status === CHART_STATUS.ERROR ? 'Chart unavailable' : 'Loading chart...');
    return;
  }

  svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`);
  svg.setAttribute('aria-label', `BTCUSDT ${preferences.interval} ${preferences.mode} chart with ${model.candles.length} candles`);
  renderGrid(svg, model);
  renderReferences(svg, model);
  if (preferences.mode === 'line') renderLine(svg, model);
  else renderCandles(svg, model);
  if (preferences.showVolume) renderVolume(svg, model);
  renderAxes(svg, model);
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

function renderCandles(svg, model) {
  const group = svgNode('g', { class: 'chart-candles' });
  for (const candle of model.candles) {
    const className = `chart-candle chart-candle-${candle.direction}`;
    group.append(svgNode('line', {
      x1: candle.x,
      y1: candle.wickTop,
      x2: candle.x,
      y2: candle.wickBottom,
      class: `${className} chart-wick`
    }));
    group.append(svgNode('rect', {
      x: candle.x - candle.bodyWidth / 2,
      y: candle.bodyY,
      width: candle.bodyWidth,
      height: candle.bodyHeight,
      rx: 0.8,
      class: `${className} chart-body`
    }));
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
    group.append(svgText(tick.x, model.height - 5, formatTime(tick.value), 'chart-time-label', { anchor: tick.index === 0 ? 'start' : tick.index === model.candles.length - 1 ? 'end' : 'middle' }));
  }
  if (model.showVolume) {
    const latestVolume = model.candles.at(-1)?.volume;
    if (Number.isFinite(latestVolume)) group.append(svgText(model.plotLeft, model.volumeTop + 11, `VOL ${formatVolume(latestVolume)}`, 'chart-volume-label'));
  }
  svg.append(group);
}

function renderEmpty(svg, label) {
  svg.setAttribute('viewBox', `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`);
  svg.append(svgText(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, label, 'chart-empty-label', { anchor: 'middle' }));
}

function chartStatusLabel(status, errorMessage, lastLoadedAt, now) {
  if (status === CHART_STATUS.ERROR) return errorMessage || 'Chart unavailable';
  if (status === CHART_STATUS.LOADING) return 'Loading candles';
  if (status === CHART_STATUS.READY) {
    if (!Number.isFinite(lastLoadedAt)) return 'Live';
    const age = Math.max(0, now - lastLoadedAt);
    if (age < 60_000) return 'Live · synced <1m ago';
    return `Live · synced ${Math.floor(age / 60_000)}m ago`;
  }
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

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp));
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
