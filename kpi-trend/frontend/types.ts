/**
 * Типы данных, которые бэкенд (FastAPI) отдаёт в JSON.
 * Зеркало `backend/app/models.py` — при изменении схемы правьте оба файла.
 */

/** Одна time-series графика. */
export interface SeriesInput {
  /** Подпись серии в тултипе, напр. "Cost". */
  name: string;
  /** Основной цвет серии (line / border / marker), HEX. */
  color: string;
  /** Значения; длина и порядок должны совпадать с `categories`. */
  data: number[];
  /** Сколько знаков после запятой показывать в тултипе (по умолчанию 2). */
  decimals?: number;
  /**
   * Только для spline-серии: второй цвет «перелива» в середине линии.
   * Если не задан, используется лаймовый оттенок по умолчанию.
   */
  highlightColor?: string;
}

/** Агрегаты по серии, которые считает бэкенд. */
export interface SeriesStats {
  min: number;
  max: number;
  avg: number;
  last: number;
  total: number;
}

/** То, что реально нужно компоненту графика: ось X + 4 серии. */
export interface ChartPayload {
  categories: string[];
  /** Series 1 — заливка (area), напр. "Cost". */
  area: SeriesInput;
  /** Series 2 — сглаженная линия (spline), напр. "ROI confirmed". */
  spline: SeriesInput;
  /** Series 3 — прямая линия с маркерами (line), напр. "Conversions". */
  line: SeriesInput;
  /** Series 4 — бары (bar), напр. "CPA". */
  bar: SeriesInput;
}

/** Полный ответ API: payload + посчитанные бэкендом агрегаты. */
export interface ChartResponse extends ChartPayload {
  stats: Record<string, SeriesStats>;
}
