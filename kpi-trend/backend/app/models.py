"""Pydantic-схемы API.

Поля отдаются в camelCase (`highlightColor`), чтобы JSON один-в-один
совпадал с типами фронтенда (`frontend/types.ts`), но внутри Python
используются snake_case-имена.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

#: Ключи 4 серий графика в фиксированном порядке (порядок = порядок строк в тултипе).
SERIES_KEYS: tuple[str, ...] = ("area", "spline", "line", "bar")


class _CamelModel(BaseModel):
    """Базовая модель: snake_case внутри, camelCase в JSON."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SeriesInput(_CamelModel):
    """Одна time-series. Совпадает с `SeriesInput` во фронтенде."""

    name: str = Field(description='Подпись серии в тултипе, напр. "Cost".')
    color: str = Field(description="Основной цвет серии (HEX), напр. #F7E05C.")
    data: list[float] = Field(description="Значения; длина должна совпадать с categories.")
    decimals: int = Field(
        default=2,
        ge=0,
        le=6,
        description="Сколько знаков после запятой показывать в тултипе.",
    )
    highlight_color: str | None = Field(
        default=None,
        description="Доп. цвет «перелива» для spline-серии (опционально).",
    )


class SeriesStats(_CamelModel):
    """Агрегаты по серии — считает бэкенд, показывать их необязательно."""

    min: float
    max: float
    avg: float
    last: float
    total: float


class ChartResponse(_CamelModel):
    """Полный payload графика: ось X + 4 серии + агрегаты."""

    categories: list[str]
    area: SeriesInput
    spline: SeriesInput
    line: SeriesInput
    bar: SeriesInput
    stats: dict[str, SeriesStats]

    @model_validator(mode="after")
    def _same_length(self) -> "ChartResponse":
        expected = len(self.categories)
        for key in SERIES_KEYS:
            series: SeriesInput = getattr(self, key)
            if len(series.data) != expected:
                raise ValueError(
                    f'Series "{key}" has {len(series.data)} points, '
                    f"but categories has {expected}."
                )
        return self


class ChartRenderRequest(_CamelModel):
    """Вход для POST /api/chart/render — «передать свои 4 последовательности».

    `categories` опциональны: если не переданы, бэкенд сгенерирует даты
    в том же количестве, что и длина серий.
    """

    area: SeriesInput
    spline: SeriesInput
    line: SeriesInput
    bar: SeriesInput
    categories: list[str] | None = Field(
        default=None,
        description="Подписи оси X. Если не переданы — генерируются автоматически.",
    )

    @model_validator(mode="after")
    def _check_lengths(self) -> "ChartRenderRequest":
        lengths = {key: len(getattr(self, key).data) for key in SERIES_KEYS}
        if len(set(lengths.values())) != 1:
            raise ValueError(
                "All four series must have the same number of points, "
                f"got {lengths}."
            )
        if not next(iter(lengths.values())):
            raise ValueError("Series must not be empty.")
        if self.categories is not None and len(self.categories) != next(
            iter(lengths.values())
        ):
            raise ValueError(
                f"categories has {len(self.categories)} labels but series have "
                f"{next(iter(lengths.values()))} points."
            )
        return self
