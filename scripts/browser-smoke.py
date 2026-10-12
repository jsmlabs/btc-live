"""Optional Chromium DOM and WebSocket integration smoke (no remote hosts).
Requires Python Playwright and installed Chromium. Run: python scripts/browser-smoke.py
MV3 service-worker activation and live Binance traffic require separate manual QA.
"""
import asyncio
import base64
import json
import os
import re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent


def module_url(path, cache=None):
    cache = {} if cache is None else cache
    path = path.resolve()
    if path in cache:
        return cache[path]
    source = path.read_text(encoding='utf-8')

    def replace(match):
        relative = match.group(2)
        if not relative.startswith('.'):
            raise ValueError(f'Unexpected non-relative import: {relative}')
        return f'{match.group(1)}{module_url((path.parent / relative), cache)}{match.group(3)}'

    source = re.sub(r'((?:from\s+|import\s*)[\'\"])(\.[^\'\"]+)([\'\"])', replace, source)
    cache[path] = 'data:text/javascript;base64,' + base64.b64encode(source.encode()).decode()
    return cache[path]


async def main():
    async with async_playwright() as pw:
        chromium_path = os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        browser = await pw.chromium.launch(headless=True, executable_path=chromium_path, args=[
            '--no-sandbox', '--disable-dev-shm-usage'
        ])
        try:
            page = await browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.set_content((ROOT / 'tests/browser-smoke.html').read_text())
            modules = {name: module_url(ROOT / path) for name, path in {
                'chart': 'ui/chart.js',
                'scheduler': 'ui/render-scheduler.js',
                'socket': 'market/binance-websocket.js'
            }.items()}
            result = await page.evaluate('''async (urls) => {
              const {renderBtcChart} = await import(urls.chart);
              const {createRenderScheduler} = await import(urls.scheduler);
              const {createBinanceSocket} = await import(urls.socket);
              const now=Date.now();
              const chart={preferences:{interval:'5m',mode:'candles',showVolume:true},status:'READY',lastLoadedAt:now,errorMessage:null,
                candles:[{openTime:now-300000,open:100,high:110,low:90,close:105,volume:20}]};
              const state={currentPrice:105,open24h:100,high24h:112,low24h:85};
              const svg=document.getElementById('dashboardChartSvg');
              renderBtcChart(chart,state,now);
              const first=svg.firstChild;
              const rects=svg.querySelectorAll('rect').length;
              renderBtcChart({...chart,candles:chart.candles.map(c=>({...c}))},{...state},now+120000);
              const reused=svg.firstChild===first;
              renderBtcChart(chart,{...state,currentPrice:109},now);
              const rebuilt=svg.firstChild!==first;
              let paints=0; const scheduler=createRenderScheduler(()=>paints++);
              for(let i=0;i<100;i++) scheduler.schedule();
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              scheduler.dispose();
              const NativeWebSocket=globalThis.WebSocket;
              const instances=[];
              class FakeSocket {
                static CONNECTING=0; static OPEN=1; static CLOSED=3;
                constructor(url){ this.url=url; this.readyState=0; this.handlers={}; instances.push(this); }
                addEventListener(type,fn){ (this.handlers[type]??=[]).push(fn); }
                emit(type,event={}){ if(type==='open')this.readyState=1; if(type==='close')this.readyState=3; for(const fn of this.handlers[type]??[])fn(event); }
                close(){ this.readyState=3; }
              }
              globalThis.WebSocket=FakeSocket;
              let events=0; let recover;
              try {
                const feed=createBinanceSocket({onTrade:()=>events++,setTimeoutFn:fn=>{recover=fn;return 1;},clearTimeoutFn:()=>{}});
                instances[0].emit('open'); instances[1].emit('open');
                instances[1].emit('close');
                const marketStillOpen=feed.readyState===FakeSocket.OPEN;
                instances[0].emit('message',{data:JSON.stringify({data:{e:'aggTrade',s:'BTCUSDT',p:'100000',a:1,T:Date.now()}})});
                recover();
                const independentRecovery=instances.length===3 && instances[2].url.includes('/public/');
                feed.close();
                return {rects,reused,rebuilt,coalesced:paints===1,marketStillOpen,independentRecovery,tradeEvents:events};
              } finally {globalThis.WebSocket=NativeWebSocket;}
            }''', modules)
            assert result['rects'] > 0 and all(result[k] for k in ('reused','rebuilt','coalesced','marketStillOpen','independentRecovery')), result
            assert result['tradeEvents'] == 1 and not errors, (result, errors)
            print(json.dumps({'browser': browser.version, 'checks': result, 'pageErrors': errors}, indent=2))
        finally:
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
