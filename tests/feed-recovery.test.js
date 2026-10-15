import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalDepthBook, createBinanceDepthRuntime, DEPTH_STALE_MS } from '../market/binance-depth.js';
import { createBinanceAggTradeRuntime, AGG_TRADE_STALE_MS } from '../market/binance-aggtrades.js';

const depthSnapshot = {lastUpdateId:100,bids:[['99','2']],asks:[['101','3']]};
const depthEvent = (U,u,pu,b=[['99','4']],a=[['101','3']]) => JSON.stringify({e:'depthUpdate',s:'BTCUSDT',U,u,pu,E:1000,b,a});
function environment() {
  let time=10000;
  const sockets=[]; const timers=new Map(); let seq=0;
  return {
    now:()=>time, advance:(ms)=>{time+=ms;}, sockets,
    socketFactory:()=>{const s={readyState:1,close(){this.readyState=3;}};sockets.push(s);return s;},
    setTimeoutFn:(fn)=>{const id=++seq;timers.set(id,fn);return id;},
    clearTimeoutFn:(id)=>timers.delete(id),
    setIntervalFn:(fn)=>{const id=++seq;timers.set(id,fn);return id;},
    clearIntervalFn:(id)=>timers.delete(id),
    tick:()=>{for(const fn of [...timers.values()])fn();}
  };
}
const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
test('depth book rejects crossed candidate transactionally, retains last consistent state',()=>{
  const book=createLocalDepthBook();book.replace(depthSnapshot);
  const first={firstId:100,finalId:101,prevId:99,bids:[[99,4]],asks:[[101,3]]};
  assert.equal(book.apply(first),'applied');
  assert.equal(book.apply({...first,firstId:102,finalId:103,prevId:101,bids:[[102,1]]}),'crossed');
  assert.equal(book.updateId,101);assert.equal(book.bids.has(102),false);assert.equal(book.bids.get(99),4);
  assert.equal(book.apply({...first,firstId:102,finalId:103,prevId:101}),'applied');
});
test('depth state remains unavailable until buffered event anchors snapshot',async()=>{
  const env=environment();let resolveFetch;
  const runtime=createBinanceDepthRuntime({...env,fetchImpl:()=>new Promise(r=>{resolveFetch=r;})});
  runtime.setEnabled(true);const socket=env.sockets[0];socket.onopen();
  assert.equal(runtime.snapshot().book,null);
  resolveFetch({ok:true,json:async()=>depthSnapshot});await flush();
  assert.equal(runtime.snapshot().status,'SYNCING');assert.equal(runtime.snapshot().valid,false);
  socket.onmessage({data:depthEvent(100,101,99)});
  assert.equal(runtime.snapshot().status,'LIVE');assert.equal(runtime.snapshot().valid,true);
  env.advance(DEPTH_STALE_MS+1);
  assert.equal(runtime.snapshot().status,'STALE');assert.equal(runtime.snapshot().book,null);
  runtime.dispose();
});
test('depth gap immediately hides book and obsolete socket cannot revive state',async()=>{
  const env=environment();
  const runtime=createBinanceDepthRuntime({...env,fetchImpl:async()=>({ok:true,json:async()=>depthSnapshot})});
  runtime.setEnabled(true);const old=env.sockets[0];old.onopen();await flush();
  old.onmessage({data:depthEvent(100,101,99)});
  assert.equal(runtime.snapshot().valid,true);
  old.onmessage({data:depthEvent(103,104,102)});
  assert.equal(runtime.snapshot().status,'RECONNECTING');assert.equal(runtime.snapshot().book,null);
  old.onmessage?.({data:depthEvent(101,105,101)});
  assert.equal(runtime.snapshot().valid,false);runtime.dispose();
});
test('trade snapshot rejects stale data even before interval callback',()=>{
  const env=environment();const runtime=createBinanceAggTradeRuntime(env);
  runtime.setEnabled(true);const socket=env.sockets[0];socket.onopen();
  socket.onmessage({data:JSON.stringify({e:'aggTrade',s:'BTCUSDT',m:false,a:1,E:10000,T:10000,p:'100',q:'1'})});
  assert.equal(runtime.snapshot().valid,true);
  env.advance(AGG_TRADE_STALE_MS+1);
  assert.equal(runtime.snapshot().valid,false);assert.equal(runtime.snapshot().status,'STALE');runtime.dispose();
});
test('late snapshot response after disabling cannot restore feed',async()=>{
  const env=environment();let resolveFetch;
  const runtime=createBinanceDepthRuntime({...env,fetchImpl:()=>new Promise(r=>{resolveFetch=r;})});
  runtime.setEnabled(true);env.sockets[0].onopen();
  runtime.setEnabled(false);
  resolveFetch({ok:true,json:async()=>depthSnapshot});await flush();
  assert.equal(runtime.snapshot().status,'PAUSED');assert.equal(runtime.snapshot().book,null);
  runtime.dispose();
});
test('invalid depth message fails closed without publishing a book',async()=>{
  const env=environment();const runtime=createBinanceDepthRuntime({...env,fetchImpl:async()=>({ok:true,json:async()=>depthSnapshot})});
  runtime.setEnabled(true);env.sockets[0].onopen();await flush();
  env.sockets[0].onmessage({data:depthEvent(100,101,99)});
  assert.equal(runtime.snapshot().valid,true);
  env.sockets[0].onmessage({data:'{bad-json'});
  assert.equal(runtime.snapshot().status,'RECONNECTING');assert.equal(runtime.snapshot().book,null);
  runtime.dispose();
});

test('depth applies small candidate changes without rebuilding map identities or changing rejected state', () => {
  const book = createLocalDepthBook();
  book.replace({lastUpdateId:100,bids:[['99','2'],['98','3']],asks:[['101','4'],['102','5']]});
  const bidRef = book.bids, askRef = book.asks;
  const anchor = {firstId:100,finalId:101,prevId:99,bids:[[99,0],[97,1]],asks:[[101,0],[103,2]]};
  assert.equal(book.apply(anchor),'applied');
  assert.equal(book.bids,bidRef);
  assert.equal(book.asks,askRef);
  assert.deepEqual([...book.bids],[[98,3],[97,1]]);
  assert.deepEqual([...book.asks],[[102,5],[103,2]]);
  const originalBids = [...book.bids], originalAsks = [...book.asks];
  assert.equal(book.apply({...anchor,firstId:102,finalId:103,prevId:101,bids:[[105,2]]}),'crossed');
  assert.deepEqual([...book.bids],originalBids);
  assert.deepEqual([...book.asks],originalAsks);
  assert.equal(book.updateId,101);
});
test('depth overflow and duplicate-price updates preserve transactional state and insertion order', () => {
  const book = createLocalDepthBook();
  book.replace({lastUpdateId:100,bids:[['99','2'],['98','3']],asks:[['101','4']]});
  const oversized = Array.from({length:4000},(_,i)=>[90-i/100,1]);
  assert.equal(book.apply({firstId:100,finalId:101,prevId:99,bids:oversized,asks:[]}), 'overflow');
  assert.equal(book.anchored,false);
  assert.deepEqual([...book.bids],[[99,2],[98,3]]);
  assert.equal(book.apply({firstId:100,finalId:101,prevId:99,bids:[[99,0],[99,5]],asks:[]}), 'applied');
  assert.deepEqual([...book.bids],[[98,3],[99,5]]);
});
