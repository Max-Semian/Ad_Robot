"""Тесты API графика: health, sample, random и приём 4 своих последовательностей."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.sample_data import SAMPLE_CATEGORIES

client = TestClient(app)


def _series(value: float, color: str = "#000000") -> dict:
    return {"name": "x", "color": color, "data": [value] * 4}


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_sample_dataset_shape() -> None:
    payload = client.get("/api/chart/sample").json()

    assert payload["categories"] == SAMPLE_CATEGORIES
    for key in ("area", "spline", "line", "bar"):
        assert len(payload[key]["data"]) == len(SAMPLE_CATEGORIES)
        assert payload[key]["name"]
        assert payload[key]["color"].startswith("#")
        assert set(payload["stats"][key]) == {"min", "max", "avg", "last", "total"}


def test_sample_uses_reference_colors() -> None:
    payload = client.get("/api/chart/sample").json()

    assert payload["area"]["color"] == "#FCF893"
    assert payload["bar"]["color"] == "#3670FC"
    assert payload["spline"]["color"] == "#118603"
    assert payload["spline"]["highlightColor"] == "#60BB21"
    assert payload["line"]["color"] == "#B601FC"


def test_random_is_reproducible_with_seed() -> None:
    first = client.get("/api/chart/random", params={"points": 9, "seed": 42}).json()
    second = client.get("/api/chart/random", params={"points": 9, "seed": 42}).json()

    assert first == second
    assert len(first["categories"]) == 9
    assert all(len(first[key]["data"]) == 9 for key in ("area", "spline", "line", "bar"))


def test_random_without_seed_changes() -> None:
    first = client.get("/api/chart/random").json()
    second = client.get("/api/chart/random").json()

    assert first["area"]["data"] != second["area"]["data"]


def test_render_accepts_four_sequences_and_generates_categories() -> None:
    response = client.post(
        "/api/chart/render",
        json={
            "area": _series(10.5),
            "spline": _series(300.25),
            "line": _series(7),
            "bar": _series(0.75),
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["categories"] == [
        "2026-06-09",
        "2026-06-10",
        "2026-06-11",
        "2026-06-12",
    ]
    assert payload["stats"]["area"]["total"] == 42.0
    assert payload["stats"]["spline"]["max"] == 300.25


def test_render_keeps_provided_categories() -> None:
    payload = client.post(
        "/api/chart/render",
        json={
            "categories": ["Jan", "Feb", "Mar", "Apr"],
            "area": _series(1),
            "spline": _series(2),
            "line": _series(3),
            "bar": _series(4),
        },
    ).json()

    assert payload["categories"] == ["Jan", "Feb", "Mar", "Apr"]


def test_render_rejects_series_with_different_lengths() -> None:
    response = client.post(
        "/api/chart/render",
        json={
            "area": _series(1),
            "spline": {"name": "x", "color": "#000", "data": [1, 2, 3]},
            "line": _series(3),
            "bar": _series(4),
        },
    )

    assert response.status_code == 422


def test_render_rejects_categories_length_mismatch() -> None:
    response = client.post(
        "/api/chart/render",
        json={
            "categories": ["a", "b"],
            "area": _series(1),
            "spline": _series(2),
            "line": _series(3),
            "bar": _series(4),
        },
    )

    assert response.status_code == 422


def test_series_accepts_snake_case_and_alias() -> None:
    payload = client.post(
        "/api/chart/render",
        json={
            "area": {
                "name": "Cost",
                "color": "#fff",
                "data": [1, 2, 3, 4],
                "highlight_color": "#000",
                "decimals": 1,
            },
            "spline": _series(2),
            "line": _series(3),
            "bar": _series(4),
        },
    ).json()

    assert payload["area"]["highlightColor"] == "#000"
    assert payload["area"]["decimals"] == 1
