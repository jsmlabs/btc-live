// Render only contemporaneous, verified LIVE market context. Never backfill current order book data.
// Layer identity is retained when both the visual inputs and price/time projection are unchanged.
const overlayKeys = new WeakMap();
export function overlayRenderKey(model, {alerts=[],bands=[],trades=[],showAlerts=true,showLiquidity=false,showTrades=false,live=false}={}) {
  const valid = !!(model?.following && live);
  return JSON.stringify([valid, valid ? [model.minPrice,model.maxPrice,model.plotLeft,model.plotRight,
    model.priceTop,model.priceBottom,model.candles.map(c=>[c.openTime,c.closeTime,c.x])] : null,
    valid && showAlerts ? alerts : null,valid && showLiquidity ? bands.slice(0,8) : null,
    valid && showTrades ? trades.slice(-16) : null]);
}
export function renderChartMarketOverlays(svg, model, {alerts=[],bands=[],trades=[],showAlerts=true,showLiquidity=false,showTrades=false,live=false}={}) {
  const key = overlayRenderKey(model,{alerts,bands,trades,showAlerts,showLiquidity,showTrades,live});
  const existing=svg.querySelector('.chart-market-overlays');
  if(overlayKeys.get(svg)===key && (existing || !model?.following || !live)) return;
  existing?.remove();
  overlayKeys.set(svg,key);
  if(!model?.following || !live)return;
  const ns='http://www.w3.org/2000/svg';
  const group=document.createElementNS(ns,'g');group.setAttribute('class','chart-market-overlays');
  const make=(tag,props)=>{const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(props))el.setAttribute(key,String(value));return el;};
  const levels=[];
  if(showAlerts) for(const a of alerts) {
    if(a?.enabled!==true || a?.triggered===true || !Number.isFinite(a.price) || a.price<=0)continue;
    levels.push({price:a.price,label:`TARGET ${a.direction==='above'?'↑':'↓'} ${a.price.toFixed(2)}`,type:'alert'});
  }
  if(showLiquidity) for(const band of bands.slice(0,8)) {
    if(!['bid','ask'].includes(band?.side) || !Number.isFinite(band.lower) || !Number.isFinite(band.upper) || band.upper<=band.lower)continue;
    const price=(band.lower+band.upper)/2;
    levels.push({price,label:`${band.side.toUpperCase()} DEPTH`,type:band.side});
  }
  for(const level of levels) {
    if(level.price<model.minPrice || level.price>model.maxPrice)continue;
    const y=model.yForPrice(level.price);
    group.append(make('line',{x1:model.plotLeft,y1:y,x2:model.plotRight,y2:y,class:`chart-market-level chart-market-${level.type}`}));
    const label=make('text',{x:model.plotLeft+5,y:y-4,class:`chart-market-label chart-market-label-${level.type}`});
    label.textContent=level.label;group.append(label);
  }
  if(showTrades)for(const trade of trades.slice(-16)) {
    if(!Number.isSafeInteger(trade?.tradeAt) || !Number.isFinite(trade.price) ||
       !Number.isFinite(trade.notional) || trade.notional<100_000 || !['buy','sell'].includes(trade.side))continue;
    const candle=model.candles.find(c=>c.openTime<=trade.tradeAt && trade.tradeAt<=c.closeTime);
    if(!candle || trade.price<model.minPrice || trade.price>model.maxPrice)continue;
    const dot=make('circle',{cx:candle.x,cy:model.yForPrice(trade.price),r:3.4,
      class:`chart-trade-marker chart-trade-marker-${trade.side}`});
    const tooltip=make('title',{});
    tooltip.textContent=`Observed ${trade.side} execution · ${trade.quantity.toFixed(4)} BTC · ${trade.price.toFixed(2)} USDT · ${new Date(trade.tradeAt).toISOString()}`;
    dot.append(tooltip);group.append(dot);
  }
  svg.append(group);
}
