// Prova de punta a punta del xat amb IA al navegador (requereix Chrome/Chromium i internet).
// Executa: node tools/test-llm.mjs
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
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  userDataDir: '/tmp/mg-profile',
});
const page = await browser.newPage();
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
page.on('response', (r) => { if (r.status() >= 400) console.log('[http', r.status() + ']', r.url().slice(0, 140)); });
page.on('requestfailed', (r) => console.log('[reqfail]', r.url().slice(0, 140), r.failure()?.errorText));

const url = process.argv[2] || 'http://127.0.0.1:8124/';
console.log('Obrint', url);
await page.goto(url, { waitUntil: 'load', timeout: 60000 });

if (url.includes('test-llm')) {
  // Espera que la prova acabi (title = fet / error)
  const t0 = Date.now();
  while (true) {
    const title = await page.evaluate(() => document.title);
    if (['fet', 'error'].includes(title)) break;
    if (Date.now() - t0 > 900000) { console.log('TIMEOUT'); break; }
    await new Promise((r) => setTimeout(r, 10000));
  }
  const text = await page.evaluate(() => document.getElementById('log').textContent);
  console.log('=== Log ==='); console.log(text);
} else {
  // Prova la pàgina principal: espera el model i envia una pregunta
  await page.waitForFunction(
    () => document.querySelector('#model-status')?.textContent.includes('carregat') ||
          document.querySelector('#model-status')?.textContent.includes('pogut'),
    { timeout: 600000 },
  );
  const status = await page.$eval('#model-status', (el) => el.textContent);
  console.log('Estat del model:', status);
  await page.type('#chat-input', 'Quants dies de cotxe de substitució te per accident?');
  await page.click('#chat-send');
  await page.waitForFunction(
    () => document.querySelectorAll('#chat-log .msg-bot').length >= 1 &&
          !document.querySelector('#chat-log .msg-bot').textContent.includes('Pensant'),
    { timeout: 240000 },
  );
  const last = await page.$$eval('#chat-log .msg-bot', (els) => els.at(-1).textContent);
  console.log('=== Resposta del model ===');
  console.log(last.slice(0, 1200));
}
await browser.close();
