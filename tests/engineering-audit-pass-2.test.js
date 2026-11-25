import test from 'node:test';
import assert from 'node:assert/strict';
import { createBtcChartRuntime } from '../app/chart-runtime.js';
import { parseDepthEvent, parseDepthSnapshot } from '../market/binance-depth.js';
import { createDepthHistory } from '../ui/depth-history.js';
import { evaluateLiquidityBehavior } from '../ui/liquidity-behavior.js';

const NOW = 1800000000000;
const CANDLE = { openTime: NOW, closeTime: NOW + 299999, open: 100, high: 102, low: 99, close: 101, volume: 1 };
const event = JSON.stringify({e:'kline',s:'BTCUSDT',E:NOW+1,k:{i:'5m',s:'BTCUSDT',t:NOW,T:NOW+299999,o:'100',h:'102',l:'99',c:'101',v:'1',x:false}});
function chartHarness(fetchKlines = async () => [CANDLE]) {
  const sockets = [];
  const chart = createBtcChartRuntime({
    now: () => NOW, fetchKlines, loadPreferences: async () => ({interval:'5m'}),
    persistPreferences: async () => {}, createSocket() { const socket = {close(){}}; sockets.push(socket); return socket; },
    setIntervalFn: () => 1, clearIntervalFn: () => {}, setTimeoutFn: () => 1, clearTimeoutFn: () => {}
  });
  return {chart,sockets};
}
test('AUD-06: obsolete socket callbacks cannot revive disconnected chart', async () => {
  const {chart,sockets} = chartHarness();
  try {
    await chart.start();
    const socket = sockets[0], late = socket.onmessage;
    socket.onerror();
    assert.equal(chart.snapshot().status,'RECONNECTING');
    late({data:event});
    assert.equal(chart.snapshot().status,'RECONNECTING');
    assert.equal(chart.snapshot().lastStreamAt,null);
  } finally { chart.dispose(); }
});
test('AUD-07: aborted REST results cannot change hidden or offline chart', async () => {
  for (const mode of ['hidden','offline']) {
    let resolve, calls=0;
    const {chart} = chartHarness(() => ++calls === 1 ? Promise.resolve([CANDLE]) : new Promise(r => {resolve=r;}));
    try {
      await chart.start();
      const pending=chart.reload({background:true});
      if(mode==='hidden') chart.handleHidden(); else chart.handleOffline();
      resolve([{...CANDLE, close:102}]); await pending;
      assert.equal(chart.snapshot().status,mode==='hidden'?'PAUSED':'OFFLINE');
      assert.equal(chart.snapshot().candles[0].close,101);
    } finally { chart.dispose(); }
  }
});
test('AUD-08: malformed quantities cannot delete depth and snapshot prices are unique', () => {
  const msg={e:'depthUpdate',s:'BTCUSDT',U:1,u:2,pu:0,E:NOW,b:[['99','']],a:[]};
  assert.equal(parseDepthEvent(msg),null);
  assert.equal(parseDepthEvent({...msg,b:[['99',' ']]}),null);
  assert.deepEqual(parseDepthEvent({...msg,b:[['99','0']]}).bids,[[99,0]]);
  assert.equal(parseDepthSnapshot({lastUpdateId:1,bids:[['99','1'],[99,'2']],asks:[['101','1']]}),null);
});
test('AUD-09: same-slot disconnect invalidates depth history, and missing timestamps are rejected', () => {
  const h=createDepthHistory();
  const book={bids:new Map([[99,1]]),asks:new Map([[101,1]])};
  const live={status:'LIVE',book,updatedAt:2000};
  assert.equal(h.ingest(live,25,2000),true);
  assert.equal(h.ingest({status:'RECONNECTING'},25,2100),true);
  assert.equal(h.snapshot().samples[0].bands,null);
  assert.equal(h.ingest({...live,updatedAt:2200},25,2200),false);
  assert.equal(h.ingest({...live,updatedAt:undefined},25,4000),true);
  assert.equal(h.snapshot().samples.at(-1).bands,null);
  assert.equal(h.ingest({...live,updatedAt:6000},25,6000),true);
  assert.ok(h.snapshot().samples.at(-1).bands.length>0);
});
test('AUD-10: liquidity persistence counts only uninterrupted trailing observations', () => {
  const band={side:'bid',lower:75,notional:100};
  const other={side:'ask',lower:100,notional:50};
  const samples=[[band],[other],[band]].map((bands,i)=>({at:i*2000,bands}));
  const r=evaluateLiquidityBehavior({stepMs:2000,samples},4000);
  assert.equal(r.zones[0].persistence,1);
  samples[1].bands=[band];
  assert.equal(evaluateLiquidityBehavior({stepMs:2000,samples:samples.slice(1)},4000).zones[0].persistence,2);
  assert.equal(evaluateLiquidityBehavior({stepMs:2000,samples},4000).zones[0].persistence,3);
});
