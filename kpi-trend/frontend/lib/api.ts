/**
 * Тонкая обёртка над fetch для Python-бэкенда (FastAPI).
 */

import type { ChartPayload, ChartResponse } from '../types';

/** Адрес бэкенда, по которому ходит браузер (вшивается в бандл при сборке). */
export const PUBLIC_API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

/**
 * Адрес бэкенда для серверного рендера. В Docker это имя сервиса
 * (`http://backend:8000`), потому что `localhost` внутри контейнера — он сам.
 */
const INTERNAL_API_BASE_URL = (
  process.env.INTERNAL_API_BASE_URL ?? PUBLIC_API_BASE_URL
).replace(/\/+$/, '');

/** Базовый URL бэкенда для текущего окружения (браузер / сервер). */
export const API_BASE_URL =
  typeof window === 'undefined' ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

/** Универсальный запрос с понятной ошибкой при не-2xx ответе. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    ...init,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${response.status} ${response.statusText}${
        body ? `: ${body.slice(0, 300)}` : ''
      }`,
    );
  }

  return (await response.json()) as T;
}

/** Sample-датасет (тот же, что на референсе). */
export function fetchSample(): Promise<ChartResponse> {
  return request<ChartResponse>('/api/chart/sample');
}

/** Случайный датасет: `points` точек, опционально с seed. */
export function fetchRandom(points?: number, seed?: number): Promise<ChartResponse> {
  const params = new URLSearchParams();
  if (points !== undefined) params.set('points', String(points));
  if (seed !== undefined) params.set('seed', String(seed));
  const query = params.toString();
  return request<ChartResponse>(`/api/chart/random${query ? `?${query}` : ''}`);
}

/** Отправить свои 4 последовательности и получить готовый payload графика. */
export function postRender(payload: ChartPayload): Promise<ChartResponse> {
  return request<ChartResponse>('/api/chart/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
