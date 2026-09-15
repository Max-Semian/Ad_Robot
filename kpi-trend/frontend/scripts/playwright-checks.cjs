/**
 * Playwright-проверки UI графика — то, что нельзя надёжно поймать
 * оффлайн-скриптом `check:chart`.
 *
 * Покрывает:
 *  1. страница грузится без ошибок консоли / pageerror
 *  2. canvas графика отрисован
 *  3. карточки статистики: Cost, CPA, ROI confirmed, Conversions
 *  4. axis-hover тултип: дата + все 4 серии в нужном порядке
 *  5. на hover видны маркеры Cost (жёлтый) и ROI (зелёный)
 *  6. у основания есть синие CPA-бары
 *  7. Randomize меняет данные; Reset возвращает sample
 *
 * Установка:
 *   npm i -D playwright && npx playwright install chromium
 *
 * Запуск (нужны backend :8000 и frontend :3000):
 *   npm run check:playwright
 *   npm run check:playwright -- http://localhost:3000 /tmp/pw-out
 */

const path = require('node:path');
const fs = require('node:fs');

const targetUrl = process.argv[2] ?? 'http://localhost:3000';
const outDir = process.argv[3] ?? path.join('/tmp', 'kpi-playwright');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${ok ? '✓' : '✗'} ${name}${suffix}`);
}

function isCpaBlue(r, g, b) {
  return r < 130 && g > 70 && g < 180 && b > 180 && b > r + 50 && b > g + 30;
}

function isCostYellow(r, g, b) {
  return r > 230 && g > 210 && b > 100 && b < 200 && Math.abs(r - g) < 50;
}

function isRoiGreen(r, g, b) {
  // #118603 и лаймовый перелив/ореол при hover
  return g > 80 && g >= r + 30 && g >= b + 15 && r < 180 && b < 120;
}

async function sampleCanvasPixels(page, box, { x0, y0, x1, y1 }) {
  return page.evaluate(
    ({ box, x0, y0, x1, y1 }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return [];
      const ctx = canvas.getContext('2d');
      if (!ctx) return [];
      // canvas CSS box может отличаться от bitmap size
      const scaleX = canvas.width / box.width;
      const scaleY = canvas.height / box.height;
      const sx = Math.max(0, Math.floor(x0 * scaleX));
      const sy = Math.max(0, Math.floor(y0 * scaleY));
      const sw = Math.max(1, Math.floor((x1 - x0) * scaleX));
      const sh = Math.max(1, Math.floor((y1 - y0) * scaleY));
      const { data } = ctx.getImageData(sx, sy, sw, sh);
      const pixels = [];
      for (let i = 0; i < data.length; i += 4) {
        pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
      }
      return pixels;
    },
    { box: { width: box.width, height: box.height }, x0, y0, x1, y1 },
  );
}

function countMatching(pixels, predicate) {
  return pixels.filter(([r, g, b, a]) => a > 200 && predicate(r, g, b)).length;
}

async function readStatNames(page) {
  return page.locator('.stat-card .stat-head').allTextContents();
}

async function main() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    throw new Error(
      'нет пакета playwright. Установите: npm i -D playwright && npx playwright install chromium',
    );
  }

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 900, height: 800 },
    deviceScaleFactor: 1,
  });

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(1200);

  // --- 1. Page shell ---
  check('заголовок KPI Trend Chart', (await page.locator('h1').textContent())?.includes('KPI Trend Chart'));
  check('кнопка Randomize data', await page.getByRole('button', { name: 'Randomize data' }).isVisible());
  check('кнопка Reset to sample', await page.getByRole('button', { name: 'Reset to sample' }).isVisible());

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  check('canvas графика отрисован', Boolean(box && box.width > 100 && box.height > 100), box ? `${Math.round(box.width)}x${Math.round(box.height)}` : '');

  await page.screenshot({ path: path.join(outDir, '01-page.png'), fullPage: true });

  // --- 2. Stats cards ---
  const statNames = (await readStatNames(page)).map((text) => text.trim());
  check('карточка Cost', statNames.some((name) => name.includes('Cost')));
  check('карточка CPA', statNames.some((name) => name.includes('CPA')));
  check('карточка ROI confirmed', statNames.some((name) => name.includes('ROI confirmed')));
  check('карточка Conversions', statNames.some((name) => name.includes('Conversions')));
  check('ровно 4 карточки статистики', statNames.length === 4, String(statNames.length));

  // --- 3. CPA bars near baseline ---
  if (box) {
    const bottomBand = await sampleCanvasPixels(page, box, {
      x0: 20,
      y0: box.height - 28,
      x1: box.width - 20,
      y1: box.height - 2,
    });
    const blue = countMatching(bottomBand, isCpaBlue);
    check('синие CPA-бары у основания', blue >= 40, `bluePixels=${blue}`);
  }

  // --- 4. Axis hover tooltip + markers ---
  let tooltipText = null;
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.42);
    await page.waitForTimeout(900);

    tooltipText = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('div'));
      const hit = nodes
        .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
        .find((text) => /^\d{2}\.\d{2}\.\d{4}/.test(text) && /Cost/.test(text) && /CPA/.test(text));
      return hit ?? null;
    });

    check('тултип появился', Boolean(tooltipText), tooltipText ?? 'нет');
    if (tooltipText) {
      check('тултип: дата ДД.ММ.ГГГГ', /^\d{2}\.\d{2}\.\d{4}/.test(tooltipText));
      check('тултип: Cost', /Cost:\s*[\d.,]+/.test(tooltipText));
      check('тултип: CPA', /CPA:\s*[\d.,]+/.test(tooltipText));
      check('тултип: ROI confirmed', /ROI confirmed:\s*[\d.,]+/.test(tooltipText));
      check('тултип: Conversions', /Conversions:\s*[\d.,]+/.test(tooltipText));

      const costIdx = tooltipText.indexOf('Cost:');
      const cpaIdx = tooltipText.indexOf('CPA:');
      const roiIdx = tooltipText.indexOf('ROI confirmed:');
      const convIdx = tooltipText.indexOf('Conversions:');
      check(
        'тултип: порядок Cost → CPA → ROI → Conversions',
        costIdx >= 0 && cpaIdx > costIdx && roiIdx > cpaIdx && convIdx > roiIdx,
      );
    }

    // Маркеры в колонке hover: ROI на sample-точке 12.06 лежит низко (~0.8 высоты),
    // поэтому берём почти всю вертикаль средней полосы.
    const midBand = await sampleCanvasPixels(page, box, {
      x0: box.width * 0.42,
      y0: box.height * 0.08,
      x1: box.width * 0.58,
      y1: box.height * 0.92,
    });
    const yellow = countMatching(midBand, isCostYellow);
    const green = countMatching(midBand, isRoiGreen);
    check('hover-маркер Cost (жёлтый)', yellow >= 8, `yellowPixels=${yellow}`);
    check('hover-маркер ROI (зелёный)', green >= 8, `greenPixels=${green}`);

    await page.screenshot({ path: path.join(outDir, '02-hover.png'), fullPage: true });
  }

  // --- 5. Randomize / Reset ---
  const costLastBefore = await page.locator('.stat-card').filter({ hasText: 'Cost' }).locator('dd').nth(2).textContent();

  await page.getByRole('button', { name: 'Randomize data' }).click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((node) =>
      /Randomize|Loading/.test(node.textContent ?? ''),
    );
    return btn && !btn.disabled && /Randomize data/.test(btn.textContent ?? '');
  }, { timeout: 15000 });
  await page.waitForTimeout(800);

  const costLastRandom = await page.locator('.stat-card').filter({ hasText: 'Cost' }).locator('dd').nth(2).textContent();
  check(
    'Randomize меняет sample (Cost last)',
    Boolean(costLastBefore && costLastRandom && costLastBefore !== costLastRandom),
    `${costLastBefore} → ${costLastRandom}`,
  );

  await page.getByRole('button', { name: 'Reset to sample' }).click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((node) =>
      /Reset to sample|Loading/.test(node.textContent ?? ''),
    );
    return btn && !btn.disabled && /Reset to sample/.test(btn.textContent ?? '');
  }, { timeout: 15000 });
  await page.waitForTimeout(800);

  const costLastReset = await page.locator('.stat-card').filter({ hasText: 'Cost' }).locator('dd').nth(2).textContent();
  check(
    'Reset возвращает sample Cost last',
    costLastReset === costLastBefore,
    `${costLastReset} === ${costLastBefore}`,
  );

  await page.screenshot({ path: path.join(outDir, '03-after-reset.png'), fullPage: true });

  // --- 6. No page errors ---
  const realErrors = pageErrors.filter(
    (message) => !/Download the React DevTools/i.test(message) && !/favicon/i.test(message),
  );
  check('нет ошибок страницы/консоли', realErrors.length === 0, realErrors.join(' | ') || 'чисто');

  await browser.close();

  const failed = checks.filter((item) => !item.ok);
  console.log(
    `\n${checks.length - failed.length}/${checks.length} Playwright-проверок пройдено` +
      (failed.length ? `, провалено: ${failed.map((item) => item.name).join('; ')}` : ''),
  );
  console.log(`скриншоты: ${outDir}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
