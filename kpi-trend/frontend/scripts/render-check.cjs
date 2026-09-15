/**
 * Оффлайн-проверка графика — без браузера.
 *
 * Берёт данные у Python-бэкенда, собирает ECharts-опцию функцией
 * `buildOption()` из `lib/chartOption.ts` (транспилируется на лету) и проверяет
 * структуру серий и HTML тултипа: 4 серии нужных типов, у каждой своя скрытая
 * ось, порядок строк как в референсе.
 *
 * Визуальную проверку (что реально нарисовалось) делает браузер — см.
 * `scripts/visual-check.cjs`.
 *
 * Запуск: npm run check:chart   (backend должен быть поднят на :8000)
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const echarts = require('echarts');

// SVG-рендерер нужен для отрисовки в строку без DOM.
try {
  const { SVGRenderer } = require('echarts/renderers');
  echarts.use([SVGRenderer]);
} catch {
  // в полной сборке echarts рендерер уже подключён
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
const ROOT = path.resolve(__dirname, '..');

/** Скомпилировать lib/chartOption.ts в CJS прямо в памяти и вернуть buildOption. */
function loadBuildOption() {
  const file = path.join(ROOT, 'lib', 'chartOption.ts');
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });

  const module_ = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', outputText)(
    module_.exports,
    require,
    module_,
    file,
    path.dirname(file),
  );
  return module_.exports;
}

const checks = [];

/** Записать результат проверки и напечатать его. */
function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}

async function main() {
  const { buildOption, BAR_SERIES_ENABLED } = loadBuildOption();

  const response = await fetch(`${API_BASE_URL}/api/chart/sample`).catch((error) => {
    throw new Error(
      `нет связи с ${API_BASE_URL} (${error.message}).\n` +
        'Запустите backend: uvicorn app.main:app --port 8000',
    );
  });
  if (!response.ok) throw new Error(`backend ответил ${response.status}`);
  const payload = await response.json();

  const option = buildOption(echarts, payload);

  // --- 1. Тултип: дата + строки в порядке референса (выключенные серии — мимо) ---
  const keys = ['area', 'bar', 'spline', 'line'].filter(
    (key) => BAR_SERIES_ENABLED || key !== 'bar',
  );
  const tooltipHtml = option.tooltip.formatter(
    keys.map((key, seriesIndex) => ({
      seriesIndex,
      name: payload.categories[0],
      axisValueLabel: payload.categories[0],
      data: payload[key].data[0],
    })),
  );

  check('тултип: дата в формате ДД.ММ.ГГГГ', tooltipHtml.includes('09.06.2026'));
  for (const key of keys) {
    check(
      `тултип: строка «${payload[key].name}» со значением`,
      tooltipHtml.includes(`${payload[key].name}: <b>`),
    );
  }
  check(
    'тултип: белая карточка с тенью и скруглением',
    /box-shadow/.test(option.tooltip.extraCssText) &&
      /border-radius/.test(option.tooltip.extraCssText) &&
      option.tooltip.backgroundColor === '#fff',
  );

  // --- 2. Структура серий ---
  const series = option.series;
  const byName = (name) => series.find((item) => item.name === name);
  const areaSeries = byName(payload.area.name);
  const splineSeries = byName(payload.spline.name);
  const lineSeries = byName(payload.line.name);
  const barSeries = byName(payload.bar.name);
  // +1 скрытая «area point»-серия для hover-маркера Cost.
  const expectedCount = (BAR_SERIES_ENABLED ? 4 : 3) + 1;
  const hoverPoint = series.find((item) => item.name === `${payload.area.name} point`);

  check(
    `в опции ${series.length} серии (BAR_SERIES_ENABLED=${BAR_SERIES_ENABLED})`,
    series.length === expectedCount,
  );
  check(
    BAR_SERIES_ENABLED
      ? 'бары присутствуют и это типа bar'
      : 'баров в опции нет вообще (серия полностью выключена)',
    BAR_SERIES_ENABLED
      ? Boolean(barSeries) && barSeries.type === 'bar'
      : barSeries === undefined,
  );
  check(
    '4 скрытые оси значений',
    option.yAxis.length === 4 && option.yAxis.every((axis) => axis.show === false),
  );
  check(
    `порядок серий (${series.map((item) => item.name).join(' -> ')})`,
    series[0] === areaSeries &&
      (BAR_SERIES_ENABLED ? series[1] === barSeries : true) &&
      series[series.length - 3] === splineSeries &&
      series[series.length - 2] === lineSeries &&
      series[series.length - 1] === hoverPoint,
  );
  check(
    'видимые серии на разных осях (+ hover Cost делит ось с area)',
    new Set(
      series.filter((item) => item !== hoverPoint).map((item) => item.yAxisIndex),
    ).size ===
      series.length - 1,
  );
  check(
    'spline: сглаживание + толстая линия 5px',
    splineSeries.smooth === true && splineSeries.lineStyle.width === 5,
  );
  check(
    'line: квадратные маркеры в точках',
    lineSeries.symbol === 'rect' && lineSeries.showSymbol === true,
  );
  check(
    'area: заливка градиентом + hover-маркер как у других кривых',
    Boolean(areaSeries.areaStyle) &&
      areaSeries.symbol === 'circle' &&
      areaSeries.showSymbol === false &&
      Boolean(hoverPoint) &&
      hoverPoint.showSymbol === true &&
      hoverPoint.symbol === 'circle',
  );
  check(
    'ось X без подписей и тиков, как в референсе',
    option.xAxis.axisLabel.show === false && option.xAxis.axisTick.show === false,
  );

  // --- 3. Если бары включены — они должны быть плоскими полосками у основания ---
  if (BAR_SERIES_ENABLED) {
    check(
      'bar: белая заливка + цветная обводка со скруглением',
      barSeries.itemStyle.color === '#ffffff' &&
        barSeries.itemStyle.borderColor === payload.bar.color &&
        Array.isArray(barSeries.itemStyle.borderRadius),
    );

    const barAxis = option.yAxis[1];
    const extent = { min: 0.6, max: 1.4 };
    const barBottom = typeof barAxis.min === 'number' ? barAxis.min : barAxis.min(extent);
    const barTop = typeof barAxis.max === 'number' ? barAxis.max : barAxis.max(extent);
    const tallestRatio = (extent.max - barBottom) / (barTop - barBottom);
    check(
      `самый высокий бар занимает ${(tallestRatio * 100).toFixed(1)}% высоты (≤ 5%)`,
      tallestRatio <= 0.05,
    );
  }

  check(
    'API по-прежнему принимает 4 последовательности одной длины',
    keys.every((key) => payload[key].data.length === payload.categories.length) &&
      payload.bar.data.length === payload.categories.length,
  );

  const failed = checks.filter((item) => !item.ok);
  console.log(
    `\n${checks.length - failed.length}/${checks.length} проверок пройдено` +
      (failed.length ? `, провалено: ${failed.map((item) => item.name).join('; ')}` : ''),
  );
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
