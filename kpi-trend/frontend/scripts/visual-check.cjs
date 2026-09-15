/**
 * Визуальная проверка графика в настоящем браузере (headless Chromium).
 *
 * Открывает страницу, ждёт отрисовки echarts, делает скриншоты (в т.ч. с
 * наведённым тултипом), собирает ошибки консоли и текст тултипа.
 *
 * Установка (dev-only, в проект не входит):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Запуск:
 *   node scripts/visual-check.cjs http://localhost:3000
 */

const path = require('node:path');
const fs = require('node:fs');

const targetUrl = process.argv[2] ?? 'http://localhost:3000';
const outDir = process.argv[3] ?? '/tmp';
const label = new URL(targetUrl).port || 'default';

async function main() {
  const playwright = require('playwright');
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 900, height: 700 },
    deviceScaleFactor: 1,
  });

  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const shot = path.join(outDir, `chart-${label}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  // Наводим курсор в центр графика, чтобы показать тултип.
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  let tooltipText = null;
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, `chart-${label}-hover.png`), fullPage: true });
    tooltipText = await page.evaluate(() =>
      Array.from(document.querySelectorAll('div'))
        .map((node) => node.textContent ?? '')
        .find((text) => /^\d{2}\.\d{2}\.\d{4}/.test(text.trim()))
        ?.replace(/\s+/g, ' ')
        .trim() ?? null,
    );
  }

  console.log(`[${targetUrl}] скриншот: ${shot} (${fs.statSync(shot).size} байт)`);
  console.log(`[${targetUrl}] canvas: ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'НЕ НАЙДЕН'}`);
  console.log(`[${targetUrl}] тултип: ${tooltipText ?? 'не появился'}`);
  console.log(`[${targetUrl}] ошибки страницы: ${errors.length ? errors.join(' | ') : 'нет'}`);

  await browser.close();
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
