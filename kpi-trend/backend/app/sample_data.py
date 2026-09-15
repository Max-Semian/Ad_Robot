"""Sample-данные и генераторы для 4 time-series.

Цвета сняты пиксельным анализом референсного GIF (800x529, кадр 0):
карточка #FCE0E3, фон страницы #E5F0FC, заливка Cost #FCECBB
(получается из #FCF893 при alpha 0.55), бары #3670FC, spline #118603
с лаймовым переливом #60BB21, линия #B601FC.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

from .models import ChartResponse, SeriesInput, SeriesStats

#: Стартовая дата sample-ряда (в референсе — 09–15 июня).
SAMPLE_START = date(2026, 6, 9)

SAMPLE_CATEGORIES: list[str] = [
    "2026-06-09",
    "2026-06-10",
    "2026-06-11",
    "2026-06-12",
    "2026-06-13",
    "2026-06-14",
    "2026-06-15",
]

#: Палево-жёлтая заливка с градиентом, прямые сегменты (плотный верх #FCECBB).
SAMPLE_AREA = SeriesInput(
    name="Cost",
    color="#FCF893",
    decimals=2,
    data=[0.8, 2.04, 18.7, 44.36, 55.65, 63.2, 71.9],
)

#: Узкие скруглённые бары: белая заливка + синяя обводка.
SAMPLE_BAR = SeriesInput(
    name="CPA",
    color="#3670FC",
    decimals=2,
    data=[0.95, 0.68, 1.05, 1.23, 0.79, 0.91, 1.02],
)

#: Толстая сглаженная линия с переливом тёмно-зелёный -> лайм -> тёмно-зелёный.
SAMPLE_SPLINE = SeriesInput(
    name="ROI confirmed",
    color="#118603",
    highlight_color="#60BB21",
    decimals=2,
    data=[780.4, 610.78, 260.2, 161.47, 56.33, 190.6, 340.1],
)

#: Прямая линия с квадратными маркерами в каждой точке.
SAMPLE_LINE = SeriesInput(
    name="Conversions",
    color="#B601FC",
    decimals=0,
    data=[1, 3, 12, 24, 36, 52, 70],
)


def generate_categories(points: int, start: date = SAMPLE_START) -> list[str]:
    """Сгенерировать `points` ISO-дат подряд, начиная со `start`."""
    return [(start + timedelta(days=i)).isoformat() for i in range(points)]


def series_stats(values: list[float]) -> SeriesStats:
    """Посчитать min/max/avg/last/total по серии."""
    return SeriesStats(
        min=min(values),
        max=max(values),
        avg=sum(values) / len(values),
        last=values[-1],
        total=sum(values),
    )


def build_response(
    categories: list[str],
    area: SeriesInput,
    spline: SeriesInput,
    line: SeriesInput,
    bar: SeriesInput,
) -> ChartResponse:
    """Собрать payload графика вместе с агрегатами по каждой серии."""
    return ChartResponse(
        categories=categories,
        area=area,
        spline=spline,
        line=line,
        bar=bar,
        stats={
            "area": series_stats(area.data),
            "spline": series_stats(spline.data),
            "line": series_stats(line.data),
            "bar": series_stats(bar.data),
        },
    )


def sample_chart() -> ChartResponse:
    """Датасет по умолчанию (то, что видно на демо-странице до Randomize)."""
    return build_response(
        SAMPLE_CATEGORIES, SAMPLE_AREA, SAMPLE_SPLINE, SAMPLE_LINE, SAMPLE_BAR
    )


def random_chart(points: int = 7, seed: int | None = None) -> ChartResponse:
    """Свежий случайный датасет той же формы (кнопка «Randomize data»).

    `seed` делает генерацию детерминированной — используется в тестах.
    """
    rng = random.Random(seed)

    def rnd(low: float, high: float) -> float:
        return round(low + rng.random() * (high - low), 2)

    return build_response(
        generate_categories(points),
        SAMPLE_AREA.model_copy(update={"data": [rnd(1, 90) for _ in range(points)]}),
        SAMPLE_SPLINE.model_copy(update={"data": [rnd(40, 800) for _ in range(points)]}),
        SAMPLE_LINE.model_copy(update={"data": [float(round(rnd(1, 90))) for _ in range(points)]}),
        SAMPLE_BAR.model_copy(update={"data": [rnd(0.4, 1.6) for _ in range(points)]}),
    )
