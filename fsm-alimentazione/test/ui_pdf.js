const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://localhost:8765/index.html');
  await page.waitForFunction(() => document.querySelectorAll('[data-flag]').length > 0);
  await page.fill('#name', 'Filippo Messineo'); await page.fill('#goal', 'Fase 2');
  await page.check('#onoff');
  for (const [t,k,v] of [['on','kcal',2000],['on','P',165],['on','F',65],['off','kcal',1820],['off','P',165],['off','F',85]]) await page.fill(`.tgt[data-t="${t}"] [data-k="${k}"]`, String(v));
  await page.click('#btnGenerate'); await page.waitForSelector('#review .card');
  await page.evaluate(() => { window.__html = null; const orig = HTMLIFrameElement.prototype; });
  await page.click('#btnPdf');
  await page.waitForTimeout(400);
  const html = await page.evaluate(() => { const f = document.querySelector('iframe'); return f && f.contentDocument.documentElement.outerHTML; });
  const p2 = await b.newPage(); await p2.setContent(html); await p2.waitForTimeout(300);
  await p2.pdf({ path: 'test/out/ui_print.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log('pdf ok', html.length); await b.close();
})();
