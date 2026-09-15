"""FastAPI-приложение: отдаёт 4 time-series (area / spline / line / bar).

Эндпоинты:
    GET  /api/health            — проверка живости
    GET  /api/chart/sample      — sample-датасет (как на референсе)
    GET  /api/chart/random      — случайный датасет (?points=7&seed=42)
    POST /api/chart/render      — принимает свои 4 последовательности,
                                  валидирует длины и возвращает payload графика
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .models import ChartRenderRequest, ChartResponse
from .sample_data import build_response, generate_categories, random_chart, sample_chart

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="KPI Trend Chart API",
    version="1.0.0",
    description=(
        "Бэкенд для комбинированного графика из 4 time-series: "
        "area + spline + line + bar."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    """Проверка живости сервиса."""
    return {"status": "ok"}


@app.get("/api/chart/sample", response_model=ChartResponse, tags=["chart"])
def chart_sample() -> ChartResponse:
    """Sample-датасет: Cost / CPA / ROI confirmed / Conversions."""
    return sample_chart()


@app.get("/api/chart/random", response_model=ChartResponse, tags=["chart"])
def chart_random(
    points: int = Query(7, ge=2, le=90, description="Сколько точек сгенерировать."),
    seed: int | None = Query(
        None, description="Seed для воспроизводимой генерации (опционально)."
    ),
) -> ChartResponse:
    """Случайный датасет той же формы — используется кнопкой «Randomize data»."""
    return random_chart(points=points, seed=seed)


@app.post("/api/chart/render", response_model=ChartResponse, tags=["chart"])
def chart_render(payload: ChartRenderRequest) -> ChartResponse:
    """Принять 4 свои последовательности и вернуть готовый payload графика.

    Если `categories` не переданы — бэкенд сгенерирует даты
    (столько, сколько точек в сериях).
    """
    categories = payload.categories or generate_categories(len(payload.area.data))
    return build_response(
        categories, payload.area, payload.spline, payload.line, payload.bar
    )


if __name__ == "__main__":  # pragma: no cover - ручной запуск
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
