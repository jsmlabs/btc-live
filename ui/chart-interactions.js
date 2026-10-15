import { getRenderedChartModel, subscribeChartRedraw } from './chart.js';
import { compareCandles } from './candle-intelligence.js';

export function bindChartInteractions({ svg, tooltip, viewport, count, onChange }) {
  let pointerStart = null, keyboardIndex = null, selected = null;
  let compareFirst = null;
  const compareNode=document.getElementById('dashboardChartComparison');
  const ns='http://www.w3.org/2000/svg';
  function coords(e) {
    const matrix = svg.getScreenCTM?.();
    if (matrix && typeof DOMPoint !== 'undefined') {
      const p = new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
      return {x:p.x,y:p.y};
    }
    const rect = svg.getBoundingClientRect();
    return {x:(e.clientX-rect.left)/rect.width*(svg.viewBox?.baseVal?.width || 1000),y:(e.clientY-rect.top)/rect.height*(svg.viewBox?.baseVal?.height || 360)};
  }
  function hide() {
    selected = null;
    svg.querySelector('.chart-crosshair')?.remove();
    tooltip.hidden=true;
  }
  function inspect(index, y) {
    const model=getRenderedChartModel(svg);
    if (!model?.candles?.length) return;
    const candle=model.candles[Math.max(0,Math.min(index,model.candles.length-1))];
    if (!candle) return;
    const x=candle.x;
    const group=document.createElementNS(ns,'g');group.setAttribute('class','chart-crosshair');
    for (const a of [
      ['line',{x1:x,y1:model.priceTop,x2:x,y2:model.volumeBottom}],
      ['line',{x1:model.plotLeft,y1:y,x2:model.plotRight,y2:y}]
    ]) {
      const el=document.createElementNS(ns,a[0]);
      for (const [k,v] of Object.entries(a[1])) el.setAttribute(k,String(v));
      group.append(el);
    }
    const price = Math.max(model.minPrice, Math.min(model.maxPrice, model.priceForY(y)));
    selected = { openTime: candle.openTime, price };
    const label=document.createElementNS(ns,'text');
    label.setAttribute('class','chart-crosshair-price');
    label.setAttribute('x',String(model.plotRight+7));
    label.setAttribute('y',String(y+3));
    label.textContent=price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    group.append(label);
    svg.querySelector('.chart-crosshair')?.remove();svg.append(group);
    const time = new Date(candle.openTime).toISOString().replace('T',' ').slice(0,16) + ' UTC';
    const delta = (candle.close-candle.open)/candle.open*100;
    const body=Math.abs(candle.close-candle.open);
    const upperWick=candle.high-Math.max(candle.open,candle.close);
    const lowerWick=Math.min(candle.open,candle.close)-candle.low;
    const fullRange=candle.high-candle.low;
    const bodyRatio=fullRange>0 ? (body/fullRange*100).toFixed(1)+'%' : '—';
    const closeTime=Number.isFinite(candle.closeTime) ? new Date(candle.closeTime).toISOString().replace('T',' ').slice(0,16)+' UTC' : '—';
    const state=candle.closed===false?' · ACTIVE':' · CLOSED';
    tooltip.textContent = `${time}${state}  O ${candle.open.toFixed(2)}  H ${candle.high.toFixed(2)}  L ${candle.low.toFixed(2)}  C ${candle.close.toFixed(2)}  ${delta>=0?'+':''}${delta.toFixed(2)}%  BODY ${body.toFixed(2)}  RANGE ${fullRange.toFixed(2)}  BODY/RANGE ${bodyRatio}  WICKS ${upperWick.toFixed(2)}/${lowerWick.toFixed(2)}  CLOSE ${closeTime}  VOL ${Number.isFinite(candle.volume)?candle.volume.toFixed(3)+' BTC':'—'}`;
    if (candle.volumeMetrics) tooltip.textContent += `  RVOL ${candle.volumeMetrics.relative===null?'—':candle.volumeMetrics.relative.toFixed(2)+'x'}`;
    if (candle.patterns?.length) tooltip.textContent += `  PATTERN ${candle.patterns.join(', ')}`;
    tooltip.hidden=false;
  }
  function move(event) {
    const model=getRenderedChartModel(svg);if (!model) return;
    const p=coords(event);
    if (pointerStart && Math.abs(p.x-pointerStart.x)>3) {
      const delta=Math.round((pointerStart.x-p.x)/model.slot);
      if (delta) {viewport.pan(delta,count());pointerStart=p;onChange();}
    }
    const active=getRenderedChartModel(svg);if (!active) return;
    const index=Math.round((p.x-active.plotLeft)/active.slot-.5);
    if (p.x<active.plotLeft || p.x>active.plotRight || p.y<active.priceTop || p.y>active.volumeBottom) {hide();return;}
    keyboardIndex=Math.max(0,Math.min(index,active.candles.length-1));
    inspect(keyboardIndex,Math.max(active.priceTop,Math.min(active.priceBottom,p.y)));
  }
  function selectCompare() {
    const model=getRenderedChartModel(svg);
    const c=model?.candles?.[keyboardIndex];
    if(!c||!compareNode) return;
    if(!compareFirst) {compareFirst={...c}; compareNode.textContent=`Candle A selected · ${new Date(c.openTime).toISOString()} · Select Candle B with C or Shift+click`; return;}
    const comparison=compareCandles(compareFirst,c);
    if(comparison) compareNode.textContent=`A → B · Close Δ ${comparison.closeDifference.toFixed(2)} USDT (${comparison.closePercent.toFixed(2)}%) · Volume Δ ${comparison.volumeDifference===null?'—':comparison.volumeDifference.toFixed(3)+' BTC'} · A/B range ${comparison.first.range.toFixed(2)}/${comparison.second.range.toFixed(2)} · Body ${comparison.first.body.toFixed(2)}/${comparison.second.body.toFixed(2)} · Δt ${(comparison.elapsedMs/60000).toFixed(1)} min${comparison.firstActive||comparison.secondActive?' · includes active candle':''}`;
    else compareNode.textContent='Comparison unavailable';
    compareFirst=null;
  }
  function down(e) {if (e.button===0 && e.shiftKey) {const model=getRenderedChartModel(svg);if(model){const p=coords(e);keyboardIndex=Math.max(0,Math.min(model.candles.length-1,Math.round((p.x-model.plotLeft)/model.slot-.5)));selectCompare();}return;} if(e.button===0) {pointerStart=coords(e);try{svg.setPointerCapture?.(e.pointerId);}catch{}}}
  function up(e) {pointerStart=null;try{if(svg.hasPointerCapture?.(e?.pointerId))svg.releasePointerCapture(e.pointerId);}catch{}}
  function wheel(e) {
    const model = getRenderedChartModel(svg);
    if (!model) return;
    e.preventDefault();
    const {x} = coords(e);
    const anchor = Math.max(0, Math.min(1, (x - model.plotLeft) / (model.plotRight - model.plotLeft)));
    viewport.zoomAt(e.deltaY < 0 ? 1 : -1, count(), anchor);
    onChange();hide();
  }
  function keydown(e) {
    const model=getRenderedChartModel(svg);if (!model) return;
    if (['ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();keyboardIndex=Math.max(0,Math.min(model.candles.length-1,(keyboardIndex??model.candles.length-1)+(e.key==='ArrowLeft'?-1:1)));
      inspect(keyboardIndex,(model.priceTop+model.priceBottom)/2);
    } else if (e.key==='+' || e.key==='=') {e.preventDefault();viewport.zoom(1,count());onChange();}
    else if (e.key==='-') {e.preventDefault();viewport.zoom(-1,count());onChange();}
    else if (e.key==='Home') {e.preventDefault();viewport.toLive(count());onChange();}
    else if (e.key.toLowerCase()==='c') {e.preventDefault();selectCompare();}
    else if (e.key==='Escape') {compareFirst=null;if(compareNode) compareNode.textContent='Candle comparison: Shift+click or press C twice';hide();}
  }
  // Keep the inspected exchange candle and price aligned across incoming live
  // SVG redraws; a replaced SVG subtree must not make the tooltip flicker.
  const unsubscribe = subscribeChartRedraw(svg, (model) => {
    if (!selected) return;
    if (!model) { hide(); return; }
    const index = model.candles.findIndex(c => c.openTime === selected.openTime);
    if (index < 0 || selected.price < model.minPrice || selected.price > model.maxPrice) { hide(); return; }
    const y = Math.max(model.priceTop, Math.min(model.priceBottom, model.yForPrice(selected.price)));
    inspect(index, y);
  });
  function leave() { up(); hide(); }
  function reset() { viewport.toLive(count()); onChange(); }
  svg.addEventListener('pointermove',move);
  svg.addEventListener('pointerdown',down);
  svg.addEventListener('pointerup',up);
  svg.addEventListener('pointerleave',leave);
  svg.addEventListener('pointercancel',up);
  svg.addEventListener('wheel',wheel,{passive:false});
  svg.addEventListener('keydown',keydown);
  svg.addEventListener('blur',hide);
  svg.addEventListener('dblclick',reset);
  return {hide,dispose() {
    unsubscribe();
    svg.removeEventListener('pointermove',move);
    svg.removeEventListener('pointerdown',down);
    svg.removeEventListener('pointerup',up);
    svg.removeEventListener('pointerleave',leave);
    svg.removeEventListener('pointercancel',up);
    svg.removeEventListener('wheel',wheel);
    svg.removeEventListener('keydown',keydown);
    svg.removeEventListener('blur',hide);
    svg.removeEventListener('dblclick',reset);
    hide();
  }};
}
