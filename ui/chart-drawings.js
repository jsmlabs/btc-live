// User-authored price/time annotations. They are never exchange observations.
export const DRAWINGS_KEY = 'btcLiveChartDrawingsV1';
export const DRAWINGS_SCHEMA_VERSION = 1;
export const DRAWING_LIMIT = 80;
export const DRAWING_TYPES = Object.freeze(['horizontal','trend','measure','zone']);
const intervals = new Set(['1m','5m','15m','30m','1h','4h']);
export function sanitizeDrawings(value) {
  if (!Array.isArray(value)) return [];
  const found = new Set(); const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !DRAWING_TYPES.includes(item.type) ||
        typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,70}$/.test(item.id) || found.has(item.id) ||
        item.symbol !== 'BTCUSDT' || !intervals.has(item.interval) ||
        !Number.isSafeInteger(item.startTime) || item.startTime < 0 ||
        !Number.isFinite(item.startPrice) || item.startPrice <= 0 || item.startPrice > 1e8) continue;
    const endTime = item.type === 'horizontal' ? item.startTime : item.endTime;
    const endPrice = item.type === 'horizontal' ? item.startPrice : item.endPrice;
    if (!Number.isSafeInteger(endTime) || endTime < 0 || !Number.isFinite(endPrice) || endPrice <= 0 || endPrice > 1e8) continue;
    found.add(item.id);
    out.push({id:item.id,symbol:'BTCUSDT',interval:item.interval,type:item.type,
      startTime:item.startTime,startPrice:item.startPrice,endTime,endPrice});
    if (out.length >= DRAWING_LIMIT) break;
  }
  return out;
}
// Deterministic OHLC snap, independent of browser pointer events.
export function snapDrawingPrice(price, candle, enabled = false) {
  if (!Number.isFinite(price) || price <= 0 || !enabled || !candle) return price;
  const levels = [candle.open, candle.high, candle.low, candle.close]
    .filter(value => Number.isFinite(value) && value > 0);
  if (!levels.length) return price;
  return levels.reduce((best, value) => Math.abs(value-price) < Math.abs(best-price) ? value : best, levels[0]);
}
export function chartCandleIndex(x, model) {
  if (!model?.candles?.length || !Number.isFinite(x) || !Number.isFinite(model.slot) || model.slot <= 0) return -1;
  return Math.max(0, Math.min(model.candles.length-1, Math.floor((x-model.plotLeft)/model.slot)));
}
export function measureDrawing(a,b) {
  if (![a?.price,b?.price,a?.time,b?.time].every(Number.isFinite) || a.price <= 0 || b.price <= 0) return null;
  const delta=b.price-a.price;
  return {delta,percent:delta/a.price*100,basisPoints:delta/a.price*10_000,timeMs:b.time-a.time};
}
export function projectDrawing(drawing,model) {
  if (!model?.candles?.length) return null;
  const first=model.candles[0].openTime, last=model.candles.at(-1).openTime;
  const fromTime = drawing.startTime, toTime = drawing.endTime;
  if (drawing.type !== 'horizontal' && (Math.max(fromTime,toTime)<first || Math.min(fromTime,toTime)>last)) return null;
  const xForTime=(time)=>model.candles[0].x+(time-first)/(model.candles.length > 1 ? (last-first)/(model.candles.length-1) : 1)*model.slot;
  if (drawing.type==='horizontal') {
    if (drawing.startPrice < model.minPrice || drawing.startPrice > model.maxPrice) return null;
    return {x1:model.plotLeft,x2:model.plotRight,y1:model.yForPrice(drawing.startPrice),y2:model.yForPrice(drawing.startPrice)};
  }
  return {x1:xForTime(fromTime),x2:xForTime(toTime),y1:model.yForPrice(drawing.startPrice),y2:model.yForPrice(drawing.endPrice)};
}
export function createDrawingStore({read,write}={}) {
  const storage=(globalThis.browser??globalThis.chrome)?.storage?.local;
  read ??= async()=> (await storage?.get(DRAWINGS_KEY))?.[DRAWINGS_KEY];
  write ??= async(items)=> {
    if(!storage?.set)throw new Error('Local extension storage is unavailable');
    return storage.set({[DRAWINGS_KEY]:{version:DRAWINGS_SCHEMA_VERSION,items}});
  };
  let items=[];let tail=Promise.resolve();
  return {
    items:()=>items.map(x=>({...x})),
    async load(){
      const data=await read();
      items=data?.version===DRAWINGS_SCHEMA_VERSION ? sanitizeDrawings(data.items) : [];
      return this.items();
    },
    add(data){const next=sanitizeDrawings([...items,data]);if (next.length===items.length) return false;items=next;return true;},
    replace(next){items=sanitizeDrawings(next);return this.items();},
    remove(id){const n=items.length;items=items.filter(d=>d.id!==id);return n!==items.length;},
    clear(interval){items=items.filter(d=>d.interval!==interval);},
    save(){const snapshot=this.items();const operation=tail.then(()=>write(snapshot));tail=operation.catch(()=>{});return operation;}
  };
}

// UI adapter only: drawing coordinates are always stored as validated time/price values.
export function bindChartDrawings({svg,store,getInterval,onChange,onWarning=()=>{}}) {
  let tool='inspect', first=null, selected=null, drag=null, undo=[],redo=[];
  let snapEnabled=false;
  const ns='http://www.w3.org/2000/svg';
  let chartModel=null, paintedSignature=null;
  function drawingProjectionKey(model) {
    if(!model) return 'empty';
    return JSON.stringify([model.width,model.plotLeft,model.plotRight,model.priceTop,model.priceBottom,
      model.minPrice,model.maxPrice,model.slot,model.candles.map(c=>c.openTime),
      getInterval(),store.items()]);
  }
  function setModel(value){
    chartModel=value;
    const signature=drawingProjectionKey(value);
    if(signature===paintedSignature && svg.querySelector('.chart-drawing-layer')) return;
    paint();
  }
  function point(event) {
    const m=chartModel;if (!m?.candles?.length) return null;
    const matrix=svg.getScreenCTM?.();
    const pos=matrix && typeof DOMPoint!=='undefined'
      ? new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()) :
        {x:(event.clientX-svg.getBoundingClientRect().left)*m.width/svg.getBoundingClientRect().width,
         y:(event.clientY-svg.getBoundingClientRect().top)*m.height/svg.getBoundingClientRect().height};
    const index=chartCandleIndex(pos.x,m);
    const rawPrice=m.priceForY(Math.max(m.priceTop,Math.min(m.priceBottom,pos.y)));
    return {price:snapDrawingPrice(rawPrice,m.candles[index],snapEnabled || event.altKey),
      time:m.candles[index].openTime,x:pos.x,y:pos.y};
  }
  function commit(mutator) {
    const before=store.items(); mutator();
    if (JSON.stringify(before)===JSON.stringify(store.items())) return;
    undo.push(before);if(undo.length>30)undo.shift();redo=[];
    paint();onChange();
  }
  function restore(list){store.replace(list);paint();onChange();}
  function undoAction(){if(!undo.length)return;redo.push(store.items());restore(undo.pop());}
  function redoAction(){if(!redo.length)return;undo.push(store.items());restore(redo.pop());}
  function selectTool(value){tool=['inspect',...DRAWING_TYPES].includes(value)?value:'inspect';first=null;selected=null;paint();}
  function paint() {
    paintedSignature=drawingProjectionKey(chartModel);
    svg.querySelector('.chart-drawing-layer')?.remove();
    if(!chartModel)return;
    const m=chartModel,group=document.createElementNS(ns,'g');group.setAttribute('class','chart-drawing-layer');
    const defs=document.createElementNS(ns,'defs');const clip=document.createElementNS(ns,'clipPath');clip.setAttribute('id','btc-drawings-clip');
    const rect=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({x:m.plotLeft,y:m.priceTop,width:m.plotRight-m.plotLeft,height:m.priceBottom-m.priceTop}))rect.setAttribute(k,String(v));clip.append(rect);defs.append(clip);group.append(defs);
    const make=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
    const contents=document.createElementNS(ns,'g');contents.setAttribute('clip-path','url(#btc-drawings-clip)');group.append(contents);
    for(const d of store.items().filter(d=>d.interval===getInterval())) {
      const pos=projectDrawing(d,m);if(!pos)continue;
      const common={'data-drawing-id':d.id,class:`chart-drawing chart-drawing-${d.type}${selected===d.id?' chart-drawing-selected':''}`};
      let shape;
      if(d.type==='zone') {
        shape=make('rect',{...common,x:Math.min(pos.x1,pos.x2),y:Math.min(pos.y1,pos.y2),
          width:Math.abs(pos.x2-pos.x1),height:Math.abs(pos.y2-pos.y1)});
      } else shape=make('line',{...common,x1:pos.x1,y1:pos.y1,x2:pos.x2,y2:pos.y2});
      shape.setAttribute('tabindex','0');
      shape.setAttribute('aria-label',`${d.type} annotation ${d.startPrice.toFixed(2)} USDT`);
      contents.append(shape);
      if(d.type==='measure') {
        const metrics=measureDrawing({price:d.startPrice,time:d.startTime},{price:d.endPrice,time:d.endTime});
        if(metrics) {
          const text=make('text',{x:Math.min(m.plotRight-120,Math.max(m.plotLeft, (pos.x1+pos.x2)/2)),
            y:Math.max(m.priceTop+12,Math.min(m.priceBottom-4,(pos.y1+pos.y2)/2)),
            class:'chart-drawing-label'});
          text.textContent=`${metrics.percent>=0?'+':''}${metrics.percent.toFixed(2)}% · ${Math.abs(metrics.timeMs)/60000}m`;
          contents.append(text);
        }
      }
    }
    svg.append(group);
  }
  function down(e) {
    if(e.button!==0)return;
    const id=e.target.closest?.('[data-drawing-id]')?.getAttribute('data-drawing-id');
    if(id) {
      const d=store.items().find(x=>x.id===id);const p=point(e);
      if(!d || !p)return;
      e.preventDefault();e.stopImmediatePropagation();selected=id;drag={id,start:p,before:store.items(),pointerId:e.pointerId};
      try {svg.setPointerCapture?.(e.pointerId);} catch {}
      paint();return;
    }
    if(tool==='inspect')return;
    const p=point(e);if(!p || p.x<chartModel.plotLeft || p.x>chartModel.plotRight || p.y<chartModel.priceTop || p.y>chartModel.priceBottom)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(tool!=='horizontal' && !first){first=p;return;}
    const a=first??p,b=p,kind=tool;
    first=null;
    const newId=`draw-${globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    commit(()=>store.add({id:newId,symbol:'BTCUSDT',interval:getInterval(),type:kind,
      startTime:a.time,startPrice:a.price,endTime:b.time,endPrice:b.price}));
    selected=newId;
  }
  function move(e){
    if(!drag)return;
    const p=point(e);if(!p)return;
    e.preventDefault();e.stopImmediatePropagation();
    const origin=drag.before.find(d=>d.id===drag.id);if(!origin)return;
    const priceDelta=p.price-drag.start.price,timeDelta=p.time-drag.start.time;
    const next={...origin,startPrice:origin.startPrice+priceDelta,endPrice:origin.endPrice+priceDelta,
      startTime:origin.startTime+timeDelta,endTime:origin.endTime+timeDelta};
    if(next.startPrice<=0 || next.endPrice<=0 || next.startTime<0 || next.endTime<0)return;
    store.remove(drag.id);store.add(next);paint();
  }
  function up(e){if(!drag)return;e?.preventDefault();e?.stopImmediatePropagation();
    if(JSON.stringify(drag.before)!==JSON.stringify(store.items())) {undo.push(drag.before);if(undo.length>30)undo.shift();redo=[];onChange();}
    try {if(svg.hasPointerCapture?.(drag.pointerId))svg.releasePointerCapture(drag.pointerId);} catch {}
    drag=null;
  }
  function key(e){
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoAction():undoAction();}
    else if(['Delete','Backspace'].includes(e.key)&&selected){e.preventDefault();commit(()=>store.remove(selected));selected=null;}
    else if(e.key==='Escape'){first=null;selected=null;paint();}
  }
  // Capture prevents the existing pan handler from activating when editing a drawing.
  svg.addEventListener('pointerdown',down,true);svg.addEventListener('pointermove',move,true);
  svg.addEventListener('pointerup',up,true);svg.addEventListener('pointercancel',up,true);svg.addEventListener('keydown',key,true);
  return {setModel,selectTool,setSnapEnabled(value){snapEnabled=Boolean(value);},undo:undoAction,redo:redoAction,removeSelected(){if(selected){commit(()=>store.remove(selected));selected=null;}},
    dispose(){for(const [type,fn] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['keydown',key]])svg.removeEventListener(type,fn,true);svg.querySelector('.chart-drawing-layer')?.remove();}};
}
