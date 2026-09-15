# KPI Trend Chart — Python-бэкенд + Next.js

Комбинированный график из 4 time-series (**area + spline + line + bar**) в одном поле
с общим тултипом по оси X. Стили и поведение повторяют референсный GIF.

Стек: **Python 3.12 + FastAPI** (бэкенд) → **Next.js 15 + TypeScript + ECharts 5** (фронтенд).
Всё поднимается одной командой через Docker Compose.

```
Браузер ──► Next.js (:3000) ──SSR fetch──► FastAPI (:8000) ──► JSON с 4 сериями
                    └────── клиентские запросы (Randomize) ──► FastAPI (:8000)
```

## Что повторено из референса

Цвета не «на глаз»: они сняты пиксельным анализом референсного GIF (800×529),
скриншот собранной версии сравнивался с ним по гистограмме насыщенных цветов.

| Серия | Тип | Стиль | Цвет (измерен по референсу) |
|---|---|---|---|
| Cost | **area** (1-я последовательность) | заливка градиентом (плотная сверху), прямые сегменты | `#FCF893` → заливка `#FCECBB` |
| ROI confirmed | **spline** (2-я) | толстая (5px) сглаженная линия, перелив тёмно-зелёный → лайм → тёмно-зелёный | `#118603`, перелив `#60BB21` |
| Conversions | **line** (3-я) | прямая линия + квадратные маркеры в каждой точке | `#B601FC` |
| CPA | **bar** (4-я) | низкие скруглённые полоски у основания (белая заливка + синяя обводка; высота сжата осью) | `#3670FC` |

Дополнительно:

- **У каждой серии своя скрытая ось Y**, нормализованная по её собственным min/max
  (с паддингом 8% снизу и 12% сверху). Поэтому метрики разного масштаба
  (CPA ≈ 1 и ROI ≈ 600) визуально сопоставимы — как в референсе.
- **Бары CPA** — стиль из Node-архива (`kpi-trend-chart.zip`: белая заливка +
  синяя обводка), но ось сжата (`buildBarAxis` + `BAR_MAX_HEIGHT_RATIO = 0.015`),
  чтобы самый высокий бар занимал ~1.5% высоты сетки (~2–4 px, как на GIF), а не
  уходил столбиком на всю высоту. Серия в тултипе и в карточках статистики.
- **Тултип** (`trigger: 'axis'`, указатель скрыт) — белая карточка со скруглением 12px
  и тенью: сверху дата в формате `ДД.ММ.ГГГГ`, ниже 4 строки вида
  «цветной кружок + название + жирное значение» в порядке
  `Cost → CPA → ROI confirmed → Conversions`.
- **Hover**: активная точка spline/line увеличивается и получает свечение
  (`shadowBlur`) в цвете серии.
- **Оси**: подписи и тики по X скрыты, оставлена только тонкая линия
  `rgba(0,0,0,0.15)`; сетка и подписи по Y не показываются.
- **Карточка** графика — розовая `#FCE0E3` со скруглением 10px, фон страницы —
  голубой `#E5F0FC` (оба цвета измерены по референсу).

Осознанные упрощения (это тестовое, не пиксель-в-пиксель клон):

- «Перелив» на spline-линии привязан к X (лево → центр → право), а не к значению.
- Ореол вокруг активной точки сделан через `shadowBlur`, а не отдельным кругом.
- Цвет баров задаётся одним цветом серии (заливка всегда белая).

## Быстрый старт (Docker)

```bash
cd kpi-trend
docker compose up --build
```

- UI: http://localhost:3000
- API: http://localhost:8000 (`/docs` — Swagger)

Остановить: `docker compose down`.

## Локальный запуск (без Docker)

**1. Бэкенд** (терминал №1):

```bash
cd kpi-trend/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Фронтенд** (терминал №2):

```bash
cd kpi-trend/frontend
npm install
cp .env.local.example .env.local   # при необходимости поменяйте адрес API
npm run dev                        # http://localhost:3000
```

Если бэкенд не поднят, страница не падает: показывается карточка с командой запуска
и текстом ошибки.

## Проверки

```bash
# бэкенд: 10 тестов (эндпоинты, валидация длин, детерминированный random)
cd kpi-trend/backend && ./.venv/bin/python -m pytest -q

# фронтенд: сборка + типы
cd kpi-trend/frontend && npm run build

# структура опции графика и HTML тултипа (нужен запущенный бэкенд)
cd kpi-trend/frontend && npm run check:chart

# визуальная проверка в headless-браузере (нужен playwright, см. scripts/visual-check.cjs)
cd kpi-trend/frontend && npm i -D playwright && npx playwright install chromium
npm run check:visual -- http://localhost:3000   # скриншот + текст тултипа + ошибки консоли
```

## API

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/health` | проверка живости |
| GET | `/api/chart/sample` | sample-датасет (тот же, что в референсе) |
| GET | `/api/chart/random?points=7&seed=42` | случайный датасет (`seed` — для воспроизводимости) |
| POST | `/api/chart/render` | принять свои 4 последовательности и вернуть готовый payload |

Формат ответа — 4 серии + агрегаты, которые считает Python:

```json
{
  "categories": ["2026-06-09", "2026-06-10"],
  "area":   { "name": "Cost", "color": "#FCF893", "data": [0.8, 2.04], "decimals": 2, "highlightColor": null },
  "spline": { "name": "ROI confirmed", "color": "#118603", "data": [780.4, 610.78], "decimals": 2, "highlightColor": "#60BB21" },
  "line":   { "name": "Conversions", "color": "#B601FC", "data": [1, 3], "decimals": 0, "highlightColor": null },
  "bar":    { "name": "CPA", "color": "#3670FC", "data": [0.95, 0.68], "decimals": 2, "highlightColor": null },
  "stats": {
    "area": { "min": 0.8, "max": 2.04, "avg": 1.42, "last": 2.04, "total": 2.84 },
    "spline": { "…": "…" }
  }
}
```

## Как передать свои 4 последовательности

### Вариант 1 — через API

`POST /api/chart/render` принимает 4 последовательности; длины должны совпадать между
собой (и с `categories`, если они переданы). Если `categories` не передавать — бэкенд
сгенерирует ISO-даты сам.

```bash
curl -X POST http://localhost:8000/api/chart/render \
  -H 'Content-Type: application/json' \
  -d '{
    "area":   { "name": "Cost",          "color": "#FCF893", "data": [0.8, 2.04, 18.7, 44.36] },
    "spline": { "name": "ROI confirmed", "color": "#118603", "highlightColor": "#60BB21",
                "data": [780.4, 610.78, 260.2, 161.47] },
    "line":   { "name": "Conversions",   "color": "#B601FC", "decimals": 0, "data": [1, 3, 12, 24] },
    "bar":    { "name": "CPA",           "color": "#3670FC", "data": [0.95, 0.68, 1.05, 1.23] }
  }'
```

При несовпадении длин вернётся `422` с понятным текстом.

### Вариант 2 — напрямую в компонент

```tsx
import MultiSeriesChart from './components/MultiSeriesChart';

const categories = ['2026-06-09', '2026-06-10', '2026-06-11'];

<MultiSeriesChart
  categories={categories}
  area={{ name: 'Cost', color: '#FCF893', decimals: 2, data: [0.8, 2.04, 18.7] }}
  spline={{
    name: 'ROI confirmed',
    color: '#118603',
    highlightColor: '#60BB21', // опционально: цвет «перелива» в середине линии
    decimals: 2,
    data: [780.4, 610.78, 260.2],
  }}
  line={{ name: 'Conversions', color: '#B601FC', decimals: 0, data: [1, 3, 12] }}
  bar={{ name: 'CPA', color: '#3670FC', decimals: 2, data: [0.95, 0.68, 1.05] }}
/>
```

Требования к данным: `data` каждой серии — той же длины и в том же порядке, что
`categories`. ISO-даты (`YYYY-MM-DD`) в тултипе форматируются в `ДД.ММ.ГГГГ`, любые
другие подписи выводятся как есть. `decimals` — знаков после запятой (по умолчанию 2).

Пропсы: `height` (по умолчанию 380) и `background` (по умолчанию `#FCE0E3`).

## Структура проекта

```
kpi-trend/
├─ backend/                      # Python 3.12 + FastAPI
│  ├─ app/
│  │  ├─ main.py                 # эндпоинты + CORS
│  │  ├─ models.py               # Pydantic-схемы (валидация длин серий)
│  │  └─ sample_data.py          # sample-данные, random, агрегаты
│  ├─ tests/test_api.py          # 10 тестов API
│  ├─ requirements.txt / requirements-dev.txt / pytest.ini
│  └─ Dockerfile
├─ frontend/                     # Next.js 15, App Router, TypeScript
│  ├─ app/
│  │  ├─ page.tsx                # серверный компонент: фетч данных у FastAPI
│  │  ├─ layout.tsx / globals.css
│  ├─ components/
│  │  ├─ MultiSeriesChart.tsx    # React-обвязка: init / setOption / resize / dispose
│  │  └─ ChartDemo.tsx           # кнопки Randomize/Reset + карточки статистики
│  ├─ lib/
│  │  ├─ chartOption.ts          # все стили и поведение: buildOption() → опция ECharts
│  │  └─ api.ts                  # клиент API (адрес для браузера и для SSR в Docker)
│  ├─ scripts/
│  │  ├─ render-check.cjs        # структура опции + HTML тултипа
│  │  └─ visual-check.cjs        # то же, но в реальном браузере (Playwright)
│  ├─ types.ts                   # типы, зеркало backend/app/models.py
│  └─ Dockerfile
├─ docker-compose.yml            # backend + frontend одной командой
└─ README.md
```

## Как залить в свой GitHub-репозиторий

1. Создайте пустой репозиторий на GitHub (без README/gitignore — они уже есть).
2. В корне проекта:

```bash
git init
git add .
git commit -m "KPI trend chart: FastAPI backend + Next.js frontend (area + spline + line + bar)"
git branch -M main
git remote add origin git@github.com:<ваш-юзернейм>/<имя-репо>.git
# вариант по HTTPS:
# git remote add origin https://github.com/<ваш-юзернейм>/<имя-репо>.git
git push -u origin main
```
