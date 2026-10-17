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

  const routes = [
    '/', '/services', '/offers', '/store', '/orders', '/account', '/calculator', '/more',
    '/ai', '/new', '/privacy', '/notifications', '/contact', '/warranty', '/order/__smoke__',
    '/join-tech', '/staff', '/staff/order/__smoke__', '/staff/operations', '/staff/radar',
    '/staff/handoff/__smoke__', '/staff/ai-settings', '/staff/pricing', '/staff/ai-command',
    '/staff/payment-methods', '/staff/ai-owner', '/staff/whatsapp', '/staff/warranties',
    '/staff/tech-requests', '/staff/notify-settings',
  ];
  const routeFailures = [];
  for (const route of routes) {
    const before = pageErrors.length;
    try {
      await page.evaluate((path) => { window.location.hash = '#' + path; }, route);
      await page.waitForTimeout(180);
      const renderedText = (await page.locator('#root').innerText()).trim();
      if (renderedText.length <= 8) {
        routeFailures.push(`${route}: React root is blank after navigation`);
      }
      console.log(`Checked route: ${route}`);
    } catch (error) {
      routeFailures.push(`${route}: render check failed — ${error.message}`);
    }
    if (pageErrors.length > before) {
      routeFailures.push(`${route}: ${pageErrors.slice(before).join(' | ')}`);
    }
  }
  if (routeFailures.length) {
    throw new Error('Route smoke tests failed:\\n' + routeFailures.join('\\n'));
  }

  if (pageErrors.length) {
    throw new Error('Browser runtime errors:\\n' + pageErrors.join('\\n'));
  }

  console.log(`PASS: production UI mounted and notifications route works.`);
  console.log(`PASS: all ${routes.length} customer/staff routes rendered without uncaught browser errors.`);
  console.log('PASS: local-demo safety notice is visible.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(2000)]);
}
