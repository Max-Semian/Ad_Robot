'use client';

import { useEffect, useRef } from 'react';
import type { ECharts } from 'echarts';
import { buildOption } from '../lib/chartOption';
import type { SeriesInput } from '../types';

export interface MultiSeriesChartProps {
  /** Подписи оси X. ISO-даты ("2026-06-12") в тултипе показываются как "12.06.2026". */
  categories: string[];
  /** Series 1 — заливка (area), напр. Cost. */
  area: SeriesInput;
  /** Series 2 — сглаженная линия (spline), напр. ROI confirmed. */
  spline: SeriesInput;
  /** Series 3 — прямая линия с квадратными маркерами (line), напр. Conversions. */
  line: SeriesInput;
  /** Series 4 — узкие скруглённые бары (bar), напр. CPA. */
  bar: SeriesInput;
  /** Высота области графика, px или CSS-значение. По умолчанию 380. */
  height?: number | string;
  /** Цвет карточки под графиком (по умолчанию — розовый из референса). */
  background?: string;
}

/**
 * Комбинированный график из 4 time-series: area + bar + spline + line
 * с общим тултипом по оси X и независимой нормализацией каждой серии.
 *
 * Вся логика построения опции живёт в `lib/chartOption.ts`, здесь — только
 * React-обвязка. `echarts` подгружается динамически внутри эффекта: библиотеке
 * нужен DOM, поэтому так она не попадает в серверный бандл Next.js.
 */
export default function MultiSeriesChart({
  categories,
  area,
  spline,
  line,
  bar,
  height = 380,
  background = '#FCE0E3',
}: MultiSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let chart: ECharts | null = null;
    let disposed = false;
    let frame = 0;

    void (async () => {
      const echarts = await import('echarts');
      if (disposed) return;

      chart = echarts.init(element);
      chart.setOption(buildOption(echarts, { categories, area, spline, line, bar }), {
        notMerge: true,
      });
      chart.resize();
    })();

    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => chart?.resize());
    };

    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      chart?.dispose();
    };
  }, [categories, area, spline, line, bar]);

  return (
    <div
      style={{
        background,
        borderRadius: 10,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        padding: '10px 6px',
      }}
    >
      <div ref={containerRef} style={{ height, width: '100%' }} />
    </div>
  );
}
