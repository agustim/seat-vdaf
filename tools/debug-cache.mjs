// Depuració v2: estat del botó, errors globals i eliminació de cache.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const candidates = ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
const executablePath = candidates.find((c) => existsSync(c));
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  protocolTimeout: 900000,
  userDataDir: '/tmp/mg-profile',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.evaluateOnNewDocument(() => {
  window.addEventListener('error', (e) => console.log('GLOBAL ERROR:', e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => console.log('UNHANDLED REJECTION:', String(e.reason).slice(0, 200)));
});
await page.goto('http://127.0.0.1:8124/', { waitUntil: 'load', timeout: 60000 });

await page.waitForFunction(
  () => document.querySelector('#model-status')?.textContent.includes('carregat'),
  { timeout: 600000 },
);
console.log('model carregat');
const st = await page.evaluate(() => {
  const b = document.getElementById('btn-model-clear');
  return {
    btnClearExists: !!b,
    btnClearHidden: b ? b.hidden : null,
    btnClearDisabled: b ? b.disabled : null,
    dlHidden: document.getElementById('btn-model-download')?.hidden,
    caches_available: typeof caches !== 'undefined',
  };
});
console.log('estat botons:', JSON.stringify(st));
await page.evaluate(() => document.getElementById('btn-model-clear').click());
await new Promise((r) => setTimeout(r, 2500));
const after = await page.evaluate(async () => ({
  status: document.getElementById('model-status').textContent,
  note: document.getElementById('model-note').textContent.slice(0, 120),
  caches: await caches.keys(),
  dlHidden: document.getElementById('btn-model-download').hidden,
  clHidden: document.getElementById('btn-model-clear').hidden,
}));
console.log('després de clic:', JSON.stringify(after, null, 1));
await browser.close();
