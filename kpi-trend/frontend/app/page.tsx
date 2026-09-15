import ChartDemo from '../components/ChartDemo';
import { API_BASE_URL, PUBLIC_API_BASE_URL, fetchSample } from '../lib/api';
import type { ChartResponse } from '../types';

/** Данные всегда берём у бэкенда в момент запроса, без статической генерации. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let initialData: ChartResponse | null = null;
  let backendError: string | null = null;

  try {
    initialData = await fetchSample();
  } catch (cause) {
    backendError = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <main className="page">
      <h1>KPI Trend Chart</h1>
      <p className="subtitle">
        Python (FastAPI) отдаёт 4 time-series, Next.js рисует их одним графиком:
        area (Cost) + bar (CPA) + spline (ROI confirmed) + line (Conversions). Бары —
        низкие полоски у основания, как в референсе.
      </p>

      {initialData ? (
        <ChartDemo initialData={initialData} />
      ) : (
        <div className="hint-card">
          <strong>Бэкенд недоступен</strong>
          <p>
            Не удалось получить данные с <code>{API_BASE_URL}</code>.
          </p>
          <p>Запустите Python-бэкенд в отдельном терминале:</p>
          <pre>
            <code>
              cd backend{'\n'}
              python3 -m venv .venv &amp;&amp; source .venv/bin/activate{'\n'}
              pip install -r requirements.txt{'\n'}
              uvicorn app.main:app --reload --port 8000
            </code>
          </pre>
          <p>
            Ошибка: <code>{backendError}</code>
          </p>
        </div>
      )}

      <footer className="footer">
        API: <code>{PUBLIC_API_BASE_URL}</code>
      </footer>
    </main>
  );
}
