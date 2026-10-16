/** Installed Chromium MV3 smoke. Real extension origin, synthetic/offline-compatible assertions.
 * This is not a substitute for live Binance, notification or release acceptance.
 */
import assert from 'node:assert/strict';
import {mkdtemp, rm, mkdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const extensionRoot=process.env.MV3_EXTENSION_ROOT?path.resolve(root,process.env.MV3_EXTENSION_ROOT):root;
const profile=await mkdtemp(path.join(tmpdir(),'btc-live-mv3-'));
const screenshotDir=process.env.MV3_SCREENSHOT_DIR;
let context;
try{
  if(screenshotDir)await mkdir(screenshotDir,{recursive:true});
  context=await chromium.launchPersistentContext(profile,{
    channel:'chromium',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage',
      `--disable-extensions-except=${extensionRoot}`,`--load-extension=${extensionRoot}`],
    viewport:{width:1440,height:900}
  });
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:20000});
  const extensionId=new URL(worker.url()).hostname;
  assert.match(extensionId,/^[a-p]{32}$/);
  const manifest=JSON.parse(await readFile(path.join(extensionRoot,'manifest.json'),'utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.version,JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8')).version);
  assert.equal(manifest.action.default_popup,'popup/popup.html');
  const errors=[];
  const measurements=[];
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  for(const [view,width] of [['popup/popup.html',408],['dashboard/dashboard.html',1440]]){
    await page.setViewportSize({width,height:900});
    await page.goto(`chrome-extension://${extensionId}/${view}`,{waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(()=>globalThis.chrome?.runtime?.id),extensionId);
    const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(dimensions.scroll<=dimensions.width+1,`${view} overflow: ${JSON.stringify(dimensions)}`);
    if(view.startsWith('popup')){
      assert.equal(await page.locator('.stats-grid .metric-card').count(),3);
      assert.equal(await page.locator('#openTerminalButton').isVisible(),true);
    }else{
      assert.equal(await page.locator('.workspace-link').count(),6);
      assert.equal(await page.locator('.chart-toolbar > .segmented[aria-label="Chart navigation"]').count(),1);
    }
    const nav=await page.evaluate(()=>{
      const entry=performance.getEntriesByType('navigation')[0];
      return {domContentLoadedMs:Math.round(entry.domContentLoadedEventEnd-entry.startTime),loadMs:Math.round(entry.loadEventEnd-entry.startTime)};
    });
    assert.ok(nav.domContentLoadedMs>=0&&nav.loadMs>=0);
    measurements.push({view,width,...nav});
    if(view.startsWith('dashboard')){
      for(const name of ['live','analytics','replay','alerts','diagnostics','settings']){
        await page.locator('[data-workspace-target="'+name+'"]').click();
        assert.equal(await page.locator('[data-workspace-target="'+name+'"]').getAttribute('aria-pressed'),'true');
        if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,'installed-'+name+'.png'),fullPage:true});
      }
    }
    if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,view.startsWith('popup')?'installed-popup.png':'installed-dashboard.png'),fullPage:true});
    console.log(`Installed MV3 smoke: ${view} at ${width}px`);
  }
  assert.deepEqual(errors,[],'Extension page errors');
  if(screenshotDir)await writeFile(path.join(screenshotDir,'navigation-timings.json'),JSON.stringify({scope:'installed unpacked MV3 smoke, not a production benchmark',measurements},null,2)+'\\n');
  console.log('Observed navigation timings:',JSON.stringify(measurements));
  console.log(`Installed extension ${extensionId}: MV3 origin, pages, controls and initial layout verified`);
}finally{
  await context?.close();
  await rm(profile,{recursive:true,force:true});
}
