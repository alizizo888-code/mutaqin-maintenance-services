import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (data) => { serverOutput += data.toString(); });
server.stderr.on('data', (data) => { serverOutput += data.toString(); });

let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(origin);
      if (response.ok) { ready = true; break; }
    } catch {}
    if (server.exitCode !== null) break;
    await delay(250);
  }
  assert.ok(ready, `Vite preview did not start. Output: ${serverOutput}`);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => (document.querySelector('#root')?.innerText || '').trim().length > 30,
    null,
    { timeout: 15000 },
  );

  const text = await page.locator('#root').innerText();
  assert.match(text, /وضع معاينة محلي/, 'The explicit local-demo safety notice should be visible.');
  assert.match(text, /OXYGEN|مُتقن/, 'The main customer UI did not render its expected brand.');

  await page.getByRole('button', { name: 'الإشعارات' }).click();
  await page.getByRole('heading', { name: 'الإشعارات' }).waitFor({ timeout: 10000 });
  assert.ok(page.url().includes('/notifications'), 'The notifications route should be wired in App.jsx.');

  if (pageErrors.length) {
    throw new Error('Browser runtime errors:\n' + pageErrors.join('\n'));
  }

  console.log('PASS: production UI mounted without uncaught browser errors.');
  console.log('PASS: local-demo safety notice is visible.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(2000)]);
}
