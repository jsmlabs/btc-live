import test from 'node:test';
import assert from 'node:assert/strict';
import {snapDrawingPrice,chartCandleIndex,createDrawingStore} from '../ui/chart-drawings.js';
import {createChartViewport} from '../ui/chart-viewport.js';
const candle={open:100,high:110,low:90,close:105};
test('OHLC snap is opt-in and deterministic',()=>{
  assert.equal(snapDrawingPrice(104,candle),104);
  assert.equal(snapDrawingPrice(104,candle,true),105);
  assert.equal(snapDrawingPrice(108,candle,true),110);
  assert.equal(snapDrawingPrice(92,candle,true),90);
});
test('OHLC snap rejects unavailable source prices safely',()=>{
  assert.equal(snapDrawingPrice(101,{},true),101);
  assert.equal(snapDrawingPrice(101,{high:Infinity},true),101);
  assert.equal(snapDrawingPrice(101,null,true),101);
});
test('candle hit testing clamps to the visible interval',()=>{
  const model={plotLeft:50,slot:10,candles:[{}, {}, {}]};
  assert.equal(chartCandleIndex(50,model),0);
  assert.equal(chartCandleIndex(70,model),2);
  assert.equal(chartCandleIndex(-100,model),0);
  assert.equal(chartCandleIndex(1000,model),2);
  assert.equal(chartCandleIndex(20,{...model,slot:0}),-1);
});
test('drawing state replacement preserves drawings across timeframes',()=>{
 const store=createDrawingStore({read:async()=>null,write:async()=>{}});
 const make=(id,interval)=>({id,symbol:'BTCUSDT',interval,type:'horizontal',startTime:1000,startPrice:100});
 store.add(make('a','1m'));store.add(make('b','5m'));
 const before=store.items();store.clear('1m');assert.equal(store.items().length,1);
 store.replace(before);assert.deepEqual(store.items(),before);
 store.replace([...before,make('a','1m')]);assert.equal(store.items().length,2);
});
test('anchored zoom and pan keep range valid at boundaries',()=>{
 const v=createChartViewport();v.zoomAt(1,300,0);v.pan(900,300);
 const x=v.range(300);assert.ok(x.start>=0 && x.end<=300 && x.end>x.start);
 v.toLive(300);assert.equal(v.snapshot(300).following,true);
});
