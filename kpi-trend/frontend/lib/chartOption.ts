/**
 * Чистая логика построения ECharts-опции для графика из 4 time-series.
 *
 * Файл намеренно не импортирует React: он используется и клиентским
 * компонентом `components/MultiSeriesChart.tsx`, и оффлайн-проверкой
 * `npm run check:chart` (рендер в SVG через echarts SSR).
 */

import type { EChartsOption } from 'echarts';
import type { SeriesInput } from '../types';

/** Модуль echarts целиком — нужен для `echarts.init` и `echarts.graphic`. */
export type EChartsModule = typeof import('echarts');

/** То, что реально нужно для отрисовки: ось X + 4 серии. */
export interface ChartData {
  categories: string[];
  area: SeriesInput;
  spline: SeriesInput;
  line: SeriesInput;
  bar: SeriesInput;
}

/** Параметры, которые ECharts отдаёт в `tooltip.formatter` при trigger: 'axis'. */
interface AxisTooltipItem {
  seriesIndex: number;
  name: string;
  axisValueLabel?: string;
  data: number | [string | number, number];
}

/** "2026-06-12" -> "12.06.2026". Не-ISO подписи возвращаются как есть. */
export function formatDateLabel(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

/** Число с нужным количеством знаков после запятой и разделителями тысяч. */
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * HEX -> rgba(). Своя функция вместо внутренностей echarts: работает и для
 * "#abc", и для "#aabbcc", и не ломается на уже готовых rgba()-строках.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  if (full.length !== 6) return color;

  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return color;

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Скрытая ось значений для одной серии.
 *
 * Каждая серия нормализуется по своим собственным min/max (с небольшим
 * паддингом) — именно поэтому метрики с разным масштабом (CPA ≈ 1 и
 * ROI ≈ 600) визуально сопоставимы на одной высоте графика, как в референсе.
 *
 * `top_padding` — запас сверху в долях размаха значений. Для барной серии он
 * заметно больше: иначе самый высокий бар занимает ~90% высоты графика и
 * превращается в «дорожку» на всю высоту вместо бара.
 */
function buildHiddenAxis(topPadding = 0.12) {
  return {
    type: 'value' as const,
    show: false,
    min: (value: { min: number; max: number }) =>
      value.min - (value.max - value.min || 1) * 0.08,
    max: (value: { min: number; max: number }) =>
      value.max + (value.max - value.min || 1) * topPadding,
  };
}

/**
 * Рисовать ли баровую серию (4-ю последовательность).
 *
 * В референсе (GIF) и на скрине это низкие синие полоски 2–4 px у основания —
 * белая заливка + синяя обводка, ось сжата через
 * `BAR_MAX_HEIGHT_RATIO`, чтобы столбики не уходили на всю высоту графика.
 */
export const BAR_SERIES_ENABLED = true;

/** Доля высоты сетки, которую занимает самый высокий бар (~2–4 px на ~300 px). */
const BAR_MAX_HEIGHT_RATIO = 0.015;

/**
 * Ось баров: от нуля, верх = max / BAR_MAX_HEIGHT_RATIO, чтобы даже самое
 * большое значение давало полоску в BAR_MAX_HEIGHT_RATIO от высоты сетки.
 */
function buildBarAxis() {
  return {
    type: 'value' as const,
    show: false,
    // Бары стоят ровно на нижней границе сетки, как в референсе.
    min: 0,
    max: (value: { max: number }) => value.max / BAR_MAX_HEIGHT_RATIO,
  };
}

/** Собирает ECharts-опцию: 4 серии + 4 скрытые оси + общий тултип по оси X. */
export function buildOption(echarts: EChartsModule, data: ChartData): EChartsOption {
  const { categories, area, spline, line, bar } = data;

  // Порядок задаёт и series/yAxis-индексы, и порядок строк в тултипе:
  // Cost -> CPA -> ROI confirmed -> Conversions, как на референсе.
  // Бары попадают в список только когда включены (BAR_SERIES_ENABLED).
  const tooltipOrder: SeriesInput[] = [
    area,
    ...(BAR_SERIES_ENABLED ? [bar] : []),
    spline,
    line,
  ];

  return {
    backgroundColor: 'transparent',
    animationDuration: 500,
    animationEasing: 'cubicOut',
    grid: { left: 10, right: 10, top: 24, bottom: 10, containLabel: false },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: true,
      axisLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.15)' } },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    yAxis: [
      buildHiddenAxis(),
      // Ось баров: плоские полоски у основания, как в референсе.
      buildBarAxis(),
      buildHiddenAxis(),
      buildHiddenAxis(),
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'none' },
      confine: true,
      borderWidth: 0,
      padding: 0,
      backgroundColor: '#fff',
      extraCssText:
        'box-shadow: 0 10px 30px rgba(20, 20, 30, 0.18); border-radius: 12px; padding: 16px 20px;',
      textStyle: { color: '#20242c', fontSize: 15 },
      formatter: (params) => {
        const list = (Array.isArray(params) ? params : [params]) as unknown as AxisTooltipItem[];
        const first = list[0];
        const dateLabel = formatDateLabel(String(first?.axisValueLabel ?? first?.name ?? ''));

        const rows = list
          .map((item) => {
            const config = tooltipOrder[item.seriesIndex];
            if (!config) return '';
            const raw = Array.isArray(item.data) ? item.data[1] : item.data;
            const value = Number(raw) || 0;
            return `
              <div style="display:flex;align-items:center;gap:10px;margin-top:8px;font-size:15px;line-height:1.2;">
                <span style="width:13px;height:13px;border-radius:50%;background:${config.color};flex:none;"></span>
                <span style="color:#20242c;">${config.name}: <b>${formatNumber(value, config.decimals ?? 2)}</b></span>
              </div>`;
          })
          .join('');

        return `<div style="font-weight:600;color:#20242c;font-size:15px;">${dateLabel}</div>${rows}`;
      },
    },
    series: [
      // --- 1. area (Cost): заливка градиентом сверху вниз, прямые сегменты ---
      {
        name: area.name,
        type: 'line',
        data: area.data,
        yAxisIndex: 0,
        // Маркеры скрыты до hover; сам hover-dot рисует слой `${area.name} point`
        // выше заливки (иначе areaStyle перекрывает symbol этой серии).
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 11,
        smooth: false,
        lineStyle: { color: area.color, width: 2 },
        itemStyle: { color: area.color, borderColor: '#fff', borderWidth: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(area.color, 0.55) },
            { offset: 1, color: withAlpha(area.color, 0.06) },
          ]),
        },
        emphasis: {
          scale: 2,
          itemStyle: {
            color: area.color,
            borderColor: '#fff',
            borderWidth: 3,
            shadowBlur: 12,
            shadowColor: 'rgba(0, 0, 0, 0.35)',
          },
        },
        z: 1,
      },
      // --- 4. bar (CPA): белая заливка + синяя обводка; высота сжата
      // осью buildBarAxis — аккуратные полоски у низа.
      ...(BAR_SERIES_ENABLED
        ? [
            {
              name: bar.name,
              type: 'bar' as const,
              data: bar.data,
              yAxisIndex: 1,
              barWidth: '32%',
              itemStyle: {
                color: '#ffffff',
                borderColor: bar.color,
                borderWidth: 2,
                borderRadius: [4, 4, 4, 4],
              },
              emphasis: {
                itemStyle: { color: withAlpha(bar.color, 0.15) },
              },
              z: 1,
            },
          ]
        : []),
      // --- 2. spline (ROI confirmed): толстая сглаженная линия с переливом ---
      {
        name: spline.name,
        type: 'line',
        data: spline.data,
        yAxisIndex: 2,
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 9,
        lineStyle: {
          width: 5,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: spline.color },
            { offset: 0.55, color: spline.highlightColor ?? '#60BB21' },
            { offset: 1, color: spline.color },
          ]),
        },
        itemStyle: { color: spline.color, borderColor: '#fff', borderWidth: 2 },
        emphasis: {
          scale: 2,
          itemStyle: {
            shadowBlur: 20,
            shadowColor: withAlpha(spline.color, 0.55),
          },
        },
        z: 2,
      },
      // --- 3. line (Conversions): прямая линия + квадратные маркеры ---
      {
        name: line.name,
        type: 'line',
        data: line.data,
        yAxisIndex: 3,
        smooth: false,
        showSymbol: true,
        symbol: 'rect',
        symbolSize: 12,
        lineStyle: { width: 2.5, color: line.color },
        itemStyle: { color: line.color },
        emphasis: {
          scale: 1.5,
          itemStyle: {
            shadowBlur: 16,
            shadowColor: withAlpha(line.color, 0.55),
          },
        },
        z: 3,
      },
      // Cost: hover-маркер поверх заливки (как у spline при axis-hover).
      // Symbol всегда в сцене (иначе highlight не к чему применить), в покое
      // прозрачный; при axis-hover ECharts красит активную точку.
      {
        name: `${area.name} point`,
        type: 'line',
        data: area.data,
        yAxisIndex: 0,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 11,
        smooth: false,
        // Не show:false — иначе серия выпадает из axis-highlight.
        // В formatter тултипа для seriesIndex этой серии нет строки → дубля Cost нет.
        legendHoverLink: false,
        lineStyle: { width: 0, color: area.color },
        itemStyle: {
          color: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
        },
        emphasis: {
          scale: 2,
          lineStyle: { width: 0 },
          itemStyle: {
            color: area.color,
            borderColor: '#fff',
            borderWidth: 3,
            shadowBlur: 12,
            shadowColor: 'rgba(0, 0, 0, 0.35)',
          },
        },
        zlevel: 1,
        z: 10,
      },
    ],
  };
}
