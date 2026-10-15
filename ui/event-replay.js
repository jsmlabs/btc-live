import { deriveLiquidityBands } from './liquidity.js';
import { parseEventRecording } from './event-recorder.js';

/** Deterministic reducer of an independent-Futures-feed receipt log. No alerts or live state mutation. */
export function replayEventRecording(recording, bucketSize = 50) {
  if (![25,50,100,250].includes(bucketSize)) throw new RangeError('Unsupported depth price bin');
  // Validate even locally captured events; never trust replay input.
  const events = parseEventRecording(typeof recording === 'string' ? recording : JSON.stringify(recording)).events;
  let bids = null, asks = null, depthId = null, depthFrom = null, depthUpdatedAt = null;
  let segment = null, cvd = 0, tradeCount = 0, price = null, priceAt = null;
  const frames = [];
  for (const event of events) {
    if (event.kind === 'gap') {
      if (event.feed === 'depth') { bids = asks = null; depthId = depthFrom = depthUpdatedAt = null; }
      else { segment = null; cvd = 0; tradeCount = 0; price = priceAt = null; }
    } else if (event.kind === 'depth.snapshot') {
      bids = new Map(event.bids); asks = new Map(event.asks); depthId = event.updateId;
      depthFrom = event.seq; depthUpdatedAt = event.at;
    } else if (event.kind === 'depth.diff') {
      for (const [book, changes] of [[bids, event.bids], [asks, event.asks]]) {
        for (const [p,q] of changes) { if (q === 0) book.delete(p); else book.set(p,q); }
      }
      depthId = event.finalId; depthUpdatedAt = event.at;
    } else if (event.kind === 'trade') {
      if (segment !== event.segment) { segment = event.segment; cvd = 0; tradeCount = 0; }
      cvd += (event.side === 'buy' ? 1 : -1) * event.quantity;
      tradeCount++;
      price = event.price; priceAt = event.tradeAt;
    }
    let bands = null, bidNotional = null, askNotional = null;
    if (bids && asks && bids.size && asks.size && depthUpdatedAt !== null && event.at - depthUpdatedAt <= 6_000) {
      const bid = Math.max(...bids.keys()), ask = Math.min(...asks.keys());
      const midpoint = (bid + ask) / 2;
      if (bid < ask) {
        bands = deriveLiquidityBands({bids, asks}, midpoint, bucketSize, 12).bands.map(({side,lower,notional}) => ({side,lower,notional}));
        bidNotional = bands.filter((x)=>x.side==='bid').reduce((total,x)=>total+x.notional,0);
        askNotional = bands.filter((x)=>x.side==='ask').reduce((total,x)=>total+x.notional,0);
      }
    }
    frames.push({ seq:event.seq, at:event.at, kind:event.kind, depthId, depthFrom, depthReady:bands!==null,
      bucketSize, bands, bidNotional, askNotional, flowSegment:segment, cvdBtc:segment===null?null:cvd,
      tradeCount, tradeSide:event.kind==='trade'?event.side:null, tradeQuantity:event.kind==='trade'?event.quantity:null,
      price:priceAt!==null && event.at-priceAt<=15_000 ? price : null,
      tradePrice:event.kind==='trade'?event.price:null });
  }
  return frames;
}

/** Descriptive evidence only; thresholds are completeness guards, not confidence/prediction. */
export function evaluateEventConfluence(frames, index) {
  const unavailable = { status:'UNAVAILABLE', label:'Insufficient comparable event data', detail:'Needs continuous depth and executions within 10s. No predictive signal.' };
  if (!Array.isArray(frames) || !Number.isInteger(index) || index<1 || index>=frames.length) return unavailable;
  const current = frames[index];
  if (!current.depthReady || current.flowSegment===null) return unavailable;
  const cutoff = current.at - 10_000;
  const window = frames.slice(0,index+1).filter((f)=>f.at>=cutoff);
  const eligible = window.findIndex((f)=>f.depthReady && f.depthFrom===current.depthFrom && f.flowSegment===current.flowSegment);
  const recent = eligible < 0 ? [] : window.slice(eligible);
  const start = recent[0];
  if (!start || !start.depthReady || start.depthFrom!==current.depthFrom ||
      start.flowSegment!==current.flowSegment || recent.some((f)=>!f.depthReady || f.flowSegment!==current.flowSegment)) return unavailable;
  const trades = recent.filter((f)=>f.tradeQuantity!==null);
  const prices = trades.map((f)=>f.tradePrice);
  const diffs = recent.filter((f)=>f.kind==='depth.diff');
  if (trades.length<2 || !diffs.length || !Number.isFinite(start.bidNotional) || !Number.isFinite(start.askNotional)) return unavailable;
  const buyBtc=trades.filter((f)=>f.tradeSide==='buy').reduce((n,f)=>n+f.tradeQuantity,0);
  const sellBtc=trades.filter((f)=>f.tradeSide==='sell').reduce((n,f)=>n+f.tradeQuantity,0);
  const deltaBtc=buyBtc-sellBtc, priceChange=prices.at(-1)-prices[0];
  const bidChange=current.bidNotional-start.bidNotional, askChange=current.askNotional-start.askNotional;
  const aligned=Math.sign(deltaBtc)===Math.sign(priceChange) && deltaBtc!==0 && priceChange!==0;
  const label=aligned?(deltaBtc>0?'Buying pressure and price rising':'Selling pressure and price falling'):'Execution / price divergence or mixed activity';
  return {status:'OBSERVED',label,deltaBtc,priceChange,bidChange,askChange,
    detail:`Last 10s · ${trades.length} aggregates · ${diffs.length} depth updates · Δ ${deltaBtc.toFixed(4)} BTC · price ${priceChange.toFixed(2)} USDT · bid/ask displayed notional ${bidChange.toFixed(0)}/${askChange.toFixed(0)} USDT. Observable net change, not proof of absorption or intent.`};
}
