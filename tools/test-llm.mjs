// Prova del flux sota demanda del model d'IA a la pàgina principal.
// Requereix Chrome/Chromium i (per al pas "Sí") internet per baixar el model.
// Executa: node tools/test-llm.mjs [url]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const candidates = ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
const executablePath = candidates.find((c) => existsSync(c));
if (!executablePath) {
  console.log('SKIP: no s\'ha trobat cap Chromium/Chrome.');
  process.exit(0);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  protocolTimeout: 900000,
  userDataDir: '/tmp/mg-profile',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));

const url = process.argv[2] || 'http://127.0.0.1:8124/';
console.log('Obrint', url);

if (url.includes('test-llm.html')) {
  // Test directe de la llibreria (descarrega i respon)
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const t0 = Date.now();
  while (true) {
    const title = await page.evaluate(() => document.title);
    if (['fet', 'error'].includes(title)) break;
    if (Date.now() - t0 > 900000) break;
    await new Promise((r) => setTimeout(r, 10000));
  }
  const text = await page.evaluate(() => document.getElementById('log')?.textContent || '');
  console.log('=== Log ==='); console.log(text);
  await browser.close();
  process.exit(0);
}

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const textOf = (sel) => page.$eval(sel, (el) => el.textContent).catch(() => null);
const hidden = async (sel) => page.$eval(sel, (el) => el.hidden).catch(() => true);

console.log('--- 1. Estat inicial (no s\'ha de baixar res) ---');
const status0 = await textOf('#model-status');
const dlHidden0 = await hidden('#btn-model-download');
const caches0 = await page.evaluate(async () => (await caches.keys()).filter((k) => /transformers/i.test(k)));
console.log(`status: ${status0}`);
console.log(`botó descàrrega visible: ${!dlHidden0} | caches del model: ${JSON.stringify(caches0)}`);

console.log('--- 2. Pregunta → confirmació ---');
await page.type('#chat-input', 'Quants dies de cotxe de substitució tinc en cas de accident?');
await page.click('#chat-send');
await page.waitForSelector('#choice-yes', { timeout: 10000 });
const confirmText = await page.$eval('#chat-log .msg-bot:last-of-type', (el) => el.textContent);
console.log(`confirmació mostrada: ${/350 MB/.test(confirmText) ? 'sí (amb pes)' : 'revisar'} | ${confirmText.slice(0, 90)}…`);

console.log('--- 3. Clic "No" → fragments, sense descàrrega ---');
await page.click('#choice-no');
await page.waitForFunction(
  () => [...document.querySelectorAll('#chat-log .msg-bot')].some((el) => el.textContent.includes('fragments més rellevants')),
  { timeout: 15000 },
);
const caches1 = await page.evaluate(async () => (await caches.keys()).filter((k) => /transformers/i.test(k)));
console.log(`resposta amb fragments: sí | caches del model: ${JSON.stringify(caches1)} (ha de quedar buit)`);

console.log('--- 4. Segona pregunta → "Sí" → descàrrega i resposta IA ---');
await page.type('#chat-input', 'Què faig si punxo una roda?');
await page.click('#chat-send');
await page.waitForSelector('#choice-yes', { timeout: 10000 });
await page.click('#choice-yes');
await page.waitForFunction(
  () => document.querySelector('#model-status')?.textContent.includes('carregat i preparat'),
  { timeout: 900000 },
);
console.log('model carregat:', await textOf('#model-status'));
await page.waitForFunction(
  () => [...document.querySelectorAll('#chat-log .msg-bot')].some(
    (el) => !el.textContent.includes('Pensant') && el.textContent.includes('Fonts'),
  ),
  { timeout: 300000 },
);
const answer = await page.$$eval('#chat-log .msg-bot', (els) => els.at(-1).textContent);
console.log('=== Resposta de la IA ==='); console.log(answer.slice(0, 900));

console.log('--- 5. Neteja del model ---');
const cachesBeforeClear = await page.evaluate(async () => (await caches.keys()).filter((k) => /transformers/i.test(k)));
await page.evaluate(() => document.getElementById('btn-model-clear').click());
await sleep(1500);
const status2 = await textOf('#model-status');
const cachesAfterClear = await page.evaluate(async () => (await caches.keys()).filter((k) => /transformers/i.test(k)));
const dlVisible2 = !(await hidden('#btn-model-download'));
console.log(`caches abans: ${JSON.stringify(cachesBeforeClear)}`);
console.log(`caches després: ${JSON.stringify(cachesAfterClear)} (ha de quedar buit)`);
console.log(`status després: ${status2}`);
console.log(`botó descàrrega visible de nou: ${dlVisible2}`);

await browser.close();
console.log('\nFLUX COMPLET ✔');
