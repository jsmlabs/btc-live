import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MARKET_STREAM_URL,
  PUBLIC_STREAM_URL,
  createBinanceSocket,
  parseCombinedMessage
} from '../market/binance-websocket.js';

const NOW = 1_800_000_000_000;

test('Futures websocket URLs use current market/public routes', () => {
  assert.equal(MARKET_STREAM_URL, 'wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade/btcusdt@ticker');
  assert.equal(PUBLIC_STREAM_URL, 'wss://fstream.binance.com/public/stream?streams=btcusdt@bookTicker');
});

test('parseCombinedMessage parses Futures aggregate-trade envelopes', () => {
  const raw = JSON.stringify({ data: { e: 'aggTrade', s: 'BTCUSDT', p: '99999', a: 123456, T: NOW - 10 } });
  const parsed = parseCombinedMessage(raw, NOW);
  assert.equal(parsed.type, 'trade');
  assert.equal(parsed.value.currentPrice, 99999);
  assert.equal(parsed.value.lastTradeId, 123456);
});

test('parseCombinedMessage parses Futures book-ticker envelopes', () => {
  const raw = JSON.stringify({ data: { e: 'bookTicker', s: 'BTCUSDT', b: '99998.5', a: '99999.5', E: NOW - 5 } });
  const parsed = parseCombinedMessage(raw, NOW);
  assert.equal(parsed.type, 'bookTicker');
  assert.equal(parsed.value.bidPrice, 99998.5);
  assert.equal(parsed.value.askPrice, 99999.5);
});

test('parseCombinedMessage ignores malformed or unsupported events', () => {
  assert.equal(parseCombinedMessage('{', NOW), null);
  assert.equal(parseCombinedMessage(JSON.stringify({ data: { e: 'depthUpdate' } }), NOW), null);
});


test('createBinanceSocket treats Futures market/public streams independently', (t) => {
  const originalWebSocket = globalThis.WebSocket;
  const instances = [];

  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.CONNECTING;
      this.listeners = new Map();
      this.closeCalls = [];
      instances.push(this);
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    emit(type, event = {}) {
      if (type === 'open') this.readyState = FakeWebSocket.OPEN;
      if (type === 'close') this.readyState = FakeWebSocket.CLOSED;
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    close(code, reason) {
      this.closeCalls.push({ code, reason });
      this.readyState = FakeWebSocket.CLOSED;
    }
  }

  globalThis.WebSocket = FakeWebSocket;
  t.after(() => { globalThis.WebSocket = originalWebSocket; });

  let opens = 0;
  let closes = 0;
  let tradePrice = null;
  let bidPrice = null;
  const socket = createBinanceSocket({
    onOpen: () => { opens += 1; },
    onClose: () => { closes += 1; },
    onTrade: (trade) => { tradePrice = trade.currentPrice; },
    onBookTicker: (book) => { bidPrice = book.bidPrice; }
  });

  assert.equal(instances.length, 2);
  assert.deepEqual(instances.map((item) => item.url), [MARKET_STREAM_URL, PUBLIC_STREAM_URL]);
  instances[0].emit('open');
  assert.equal(opens, 1);
  instances[1].emit('open');
  assert.equal(opens, 1);
  assert.equal(socket.readyState, FakeWebSocket.OPEN);

  instances[0].emit('message', {
    data: JSON.stringify({ data: { e: 'aggTrade', s: 'BTCUSDT', p: '100123', a: 500, T: Date.now() } })
  });
  instances[1].emit('message', {
    data: JSON.stringify({ data: { e: 'bookTicker', s: 'BTCUSDT', b: '100122.5', a: '100123.5', E: Date.now() } })
  });
  assert.equal(tradePrice, 100123);
  assert.equal(bidPrice, 100122.5);

  instances[0].emit('close', { code: 1006 });
  assert.equal(closes, 1);
  assert.equal(instances[1].closeCalls.length, 0);
  socket.close();
  assert.equal(instances[1].closeCalls.length, 1);
  assert.equal(closes, 1);
});

test('book failure retries book only, preserving market events and cleanup', (t) => {
  const original = globalThis.WebSocket;
  const instances = [];
  const jobs = new Map();
  let id = 0;
  class FakeSocket {
    static CONNECTING = 0; static OPEN = 1; static CLOSED = 3;
    constructor(url) { this.url = url; this.readyState = 0; this.handlers = {}; instances.push(this); }
    addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn); }
    emit(type, event = {}) {
      if (type === 'open') this.readyState = 1;
      if (type === 'close') this.readyState = 3;
      for (const fn of this.handlers[type] ?? []) fn(event);
    }
    close() { this.readyState = 3; }
  }
  globalThis.WebSocket = FakeSocket;
  t.after(() => { globalThis.WebSocket = original; });
  const trades = [];
  const changes = [];
  const socket = createBinanceSocket({
    onTrade: (trade) => trades.push(trade.currentPrice),
    onFeedStatus: (feed, status) => changes.push(`${feed}:${status}`),
    setTimeoutFn(fn, ms) { assert.ok(ms >= 1000); jobs.set(++id, fn); return id; },
    clearTimeoutFn(value) { jobs.delete(value); }
  });
  instances[0].emit('open');
  instances[1].emit('open');
  instances[1].emit('close', { code: 1006 });
  assert.equal(socket.readyState, FakeSocket.OPEN);
  assert.equal(jobs.size, 1);
  assert.ok(changes.includes('book:RECONNECTING'));
  instances[0].emit('message', { data: JSON.stringify({ data: { e: 'aggTrade', s: 'BTCUSDT', p: '100123', a: 50, T: Date.now() } }) });
  assert.deepEqual(trades, [100123]);
  const retry = [...jobs.values()][0]; jobs.clear(); retry();
  assert.equal(instances.length, 3);
  assert.equal(instances[2].url, PUBLIC_STREAM_URL);
  instances[2].emit('open');
  assert.equal(changes.at(-1), 'book:LIVE');
  instances[1].emit('open'); // stale socket must be ignored
  socket.close();
  assert.equal(jobs.size, 0);
  instances[2].emit('close');
  assert.equal(jobs.size, 0);
});

test('market reconnect is independent from a healthy public feed', (t) => {
  const original = globalThis.WebSocket;
  const instances = [];
  const jobs = [];
  class FakeSocket {
    static CONNECTING = 0; static OPEN = 1; static CLOSED = 3;
    constructor(url) { this.url = url; this.readyState = 0; this.handlers = {}; this.closed = false; instances.push(this); }
    addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn); }
    emit(type, event = {}) { if (type === 'open') this.readyState = 1; if (type === 'close') this.readyState = 3; for (const fn of this.handlers[type] ?? []) fn(event); }
    close() { this.closed = true; this.readyState = 3; }
  }
  globalThis.WebSocket = FakeSocket;
  t.after(() => { globalThis.WebSocket = original; });
  let opens = 0;
  const socket = createBinanceSocket({
    onOpen: () => { ++opens; },
    setTimeoutFn: (fn) => { jobs.push(fn); return jobs.length; },
    clearTimeoutFn: () => {}
  });
  instances[0].emit('open'); instances[1].emit('open');
  instances[0].emit('close', { code: 1006 });
  assert.equal(instances[1].closed, false);
  jobs.shift()();
  assert.equal(instances[2].url, MARKET_STREAM_URL);
  instances[2].emit('open');
  assert.equal(opens, 2);
  assert.equal(instances[1].closed, false);
  socket.close();
});

test('stale book feed can be recovered without closing the market socket', (t) => {
  const original = globalThis.WebSocket;
  const sockets = [];
  const scheduled = [];
  class FakeSocket {
    static CONNECTING = 0; static OPEN = 1; static CLOSED = 3;
    constructor(url) { this.url = url; this.readyState = 0; this.handlers = {}; this.closed = false; sockets.push(this); }
    addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn); }
    emit(type) { if (type === 'open') this.readyState = 1; for (const fn of this.handlers[type] ?? []) fn({}); }
    close() { this.closed = true; this.readyState = 3; }
  }
  globalThis.WebSocket = FakeSocket;
  t.after(() => { globalThis.WebSocket = original; });
  const socket = createBinanceSocket({ setTimeoutFn: (fn) => { scheduled.push(fn); return scheduled.length; }, clearTimeoutFn: () => {} });
  sockets[0].emit('open'); sockets[1].emit('open');
  assert.equal(socket.reconnectFeed('book'), true);
  assert.equal(sockets[1].closed, true);
  assert.equal(sockets[0].closed, false);
  scheduled.shift()();
  assert.equal(sockets[2].url, PUBLIC_STREAM_URL);
  assert.equal(sockets[0].closed, false);
  socket.close();
});

test('combined market stream ignores oversized untrusted frames without parsing them', () => {
  assert.equal(parseCombinedMessage(' '.repeat(65_537), NOW), null);
  assert.equal(parseCombinedMessage(JSON.stringify({data:{e:'unknown'}}), NOW), null);
});
