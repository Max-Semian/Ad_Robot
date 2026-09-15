'use client';

import { useState, useTransition } from 'react';
import MultiSeriesChart from './MultiSeriesChart';
import { fetchRandom, fetchSample } from '../lib/api';
import { BAR_SERIES_ENABLED } from '../lib/chartOption';
import type { ChartResponse } from '../types';

export interface ChartDemoProps {
  /** Данные, полученные серверным рендером с Python-бэкенда. */
  initialData: ChartResponse;
}

/** Форматирование значения прогрега для карточек статистики. */
function formatStat(value: number | undefined, decimals = 2): string {
  if (value === undefined) return '—';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Тот же порядок, что и в тултипе. Выключенные серии (например, бары) не показываем. */
const STAT_KEYS = ['area', 'bar', 'spline', 'line'] as const;

const VISIBLE_STAT_KEYS = STAT_KEYS.filter(
  (key) => BAR_SERIES_ENABLED || key !== 'bar',
);

/**
 * Интерактивная часть демо: кнопки Randomize/Reset и сам график.
 * Данные каждый раз запрашиваются у Python-бэкенда (FastAPI).
 */
export default function ChartDemo({ initialData }: ChartDemoProps) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = (loader: () => Promise<ChartResponse>) => {
    setError(null);
    startTransition(async () => {
      try {
        setData(await loader());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  };

  return (
    <>
      <div className="controls">
        <button
          type="button"
          onClick={() => load(() => fetchRandom(data.categories.length))}
          disabled={isPending}
        >
          {isPending ? 'Loading…' : 'Randomize data'}
        </button>
        <button type="button" onClick={() => load(fetchSample)} disabled={isPending}>
          Reset to sample
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="chart-card">
        <MultiSeriesChart
          categories={data.categories}
          area={data.area}
          spline={data.spline}
          line={data.line}
          bar={data.bar}
        />
      </div>

      <div className="stats">
        {VISIBLE_STAT_KEYS.map((key) => {
          const series = data[key];
          const stats = data.stats?.[key];
          const decimals = series.decimals ?? 2;
          return (
            <div className="stat-card" key={key}>
              <div className="stat-head">
                <span className="stat-dot" style={{ background: series.color }} />
                {series.name}
              </div>
              <dl>
                <dt>avg</dt>
                <dd>{formatStat(stats?.avg, decimals)}</dd>
                <dt>min / max</dt>
                <dd>
                  {formatStat(stats?.min, decimals)} / {formatStat(stats?.max, decimals)}
                </dd>
                <dt>last</dt>
                <dd>{formatStat(stats?.last, decimals)}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </>
  );
}
