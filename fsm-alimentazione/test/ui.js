const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1366 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8765/index.html');
  await page.waitForFunction(() => document.querySelectorAll('[data-flag]').length > 0, null, { timeout: 15000 });
  await page.fill('#name', 'Filippo Messineo');
  await page.fill('#goal', 'Ricomposizione corporea – Fase 2');
  await page.check('#onoff');
  const set = async (t, k, v) => page.fill(`.tgt[data-t="${t}"] [data-k="${k}"]`, String(v));
  await set('on', 'kcal', 2000); await set('on', 'P', 165); await set('on', 'F', 65);
  await set('off', 'kcal', 1820); await set('off', 'P', 165); await set('off', 'F', 85);
  console.log('carbs:', await page.locator('[data-carb]').allInnerTexts());
  await page.fill('#exSearch', 'seit');
  await page.click('#exSug [data-ex]');
  console.log('excl:', await page.locator('#exList').innerText());
  await page.screenshot({ path: 'test/out/ui_form.png', fullPage: true });
  await page.click('#btnSave');
  await page.click('#btnGenerate');
  await page.waitForSelector('#review .card');
  console.log('status:', await page.locator('#status').innerText());
  await page.screenshot({ path: 'test/out/ui_review.png', fullPage: false });
  // lock + regen + edit
  await page.click('button[data-act="lock"] >> nth=0');
  await page.click('button[data-act="regen"] >> nth=1');
  const inp = page.locator('input[data-act="qo"]').first();
  await inp.fill('300'); await inp.dispatchEvent('change');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnDocx').then(async () => { })]).catch(async e => { return [null]; });
  page.on('dialog', d => d.accept());
  let d = dl;
  if (!d) { d = await Promise.all([page.waitForEvent('download'), page.click('#btnDocx')]).then(x => x[0]); }
  const fn = 'test/out/ui_' + d.suggestedFilename(); await d.saveAs(fn); console.log('download:', fn, fs.statSync(fn).size);
  await page.click('#btnPreview'); await page.waitForSelector('.docprev');
  await page.screenshot({ path: 'test/out/ui_preview.png' });
  await page.click('#modalX');
  // daily plan
  await page.click('#btnBack');
  await page.uncheck('#onoff');
  await set('std', 'kcal', 1800); await set('std', 'P', 140); await set('std', 'F', 60);
  await page.check('input[name="planType"][value="daily"]');
  await page.selectOption('#freeDay', '5');
  await page.click('#btnGenerate');
  await page.waitForSelector('button[data-act="regday"]');
  await page.click('button[data-act="regday"] >> nth=2');
  await page.screenshot({ path: 'test/out/ui_daily.png', fullPage: false });
  const d2 = await Promise.all([page.waitForEvent('download'), page.click('#btnDocx')]).then(x => x[0]);
  const fn2 = 'test/out/ui_daily_' + d2.suggestedFilename(); await d2.saveAs(fn2); console.log('download2:', fn2);
  // archive
  await page.click('.nav[data-view="archive"]');
  console.log('archive:', (await page.locator('#archive').innerText()).slice(0, 200));
  await page.click('.nav[data-view="settings"]');
  await page.screenshot({ path: 'test/out/ui_settings.png', fullPage: true });
  console.log('errors:', errors);
  await browser.close();
})();
