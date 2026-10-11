from collections.abc import Sequence

import pytest

from planner.domain.metrics import BUCKETS, Bucket, RouteMetrics
from planner.domain.ranking import (
    Candidate,
    format_duration,
    rank_key,
    rank_routes,
    risk_step,
)
from planner.domain.risk import Level

HOUR = 3600.0


def metrics(
    no_travel: float = 0.0,
    severe: float = 0.0,
    high: float = 0.0,
    avg: float | None = 0.5,
    unknown: float = 0.0,
    distance: float = 800.0,
) -> RouteMetrics:
    miles: dict[Bucket, float] = dict.fromkeys(BUCKETS, 0.0)
    miles.update({"NO_TRAVEL": no_travel, "SEVERE": severe, "HIGH": high, "UNKNOWN": unknown})
    miles["LOW"] = distance - no_travel - severe - high - unknown
    worst = Level.NO_TRAVEL if no_travel else Level.SEVERE if severe else Level.LOW
    return RouteMetrics(miles, avg, worst, 0.0, no_travel == 0, distance)


def cand(
    route_id: str,
    duration_h: float = 12.0,
    *,
    no_travel: float = 0.0,
    severe: float = 0.0,
    high: float = 0.0,
    avg: float | None = 0.5,
    unknown: float = 0.0,
) -> Candidate:
    m = metrics(no_travel=no_travel, severe=severe, high=high, avg=avg, unknown=unknown)
    return Candidate(route_id, m, duration_h * HOUR)


def ids(ranked: Sequence[Candidate]) -> list[str]:
    return [c.route_id for c in ranked]


class TestEachCriterionDecidesWhenEarlierOnesTie:
    def test_no_travel_miles(self) -> None:
        r = rank_routes([cand("a", no_travel=5, severe=0), cand("b", no_travel=0, severe=100)])

        assert ids(r.ranked) == ["b", "a"]
        assert r.reason_code == "no_travel"
        assert r.reason == "Fewest No Travel miles (0 vs 5)"

    def test_severe_miles(self) -> None:
        r = rank_routes([cand("a", severe=38), cand("b", severe=0, high=300)])

        assert ids(r.ranked) == ["b", "a"]
        assert r.reason_code == "severe"
        assert r.reason == "Fewest severe miles (0 vs 38)"

    def test_high_miles(self) -> None:
        r = rank_routes([cand("a", high=44), cand("b", high=10, avg=3.0)])

        assert ids(r.ranked) == ["b", "a"]
        assert r.reason_code == "high"
        assert r.reason == "Fewest high-risk miles (10 vs 44)"

    def test_average_risk(self) -> None:
        r = rank_routes([cand("a", avg=1.2, duration_h=10), cand("b", avg=0.4, duration_h=14)])

        assert ids(r.ranked) == ["b", "a"]
        assert r.reason_code == "avg_risk"
        assert r.reason == "Lowest average risk (0.40 vs 1.20)"

    def test_travel_time(self) -> None:
        r = rank_routes([cand("a", duration_h=13), cand("b", duration_h=12 + 35 / 60)])

        assert ids(r.ranked) == ["b", "a"]
        assert r.reason_code == "duration"
        assert r.reason == "Same risk, 25 min faster"


class TestTolerances:
    def test_average_risks_in_the_same_step_tie_and_time_decides(self) -> None:
        r = rank_routes([cand("a", avg=1.02, duration_h=13), cand("b", avg=1.04, duration_h=12)])

        assert ids(r.ranked) == ["b", "a"]
        assert r.reason_code == "duration"

    def test_average_risks_in_different_steps_do_not_tie(self) -> None:
        r = rank_routes([cand("a", avg=1.04, duration_h=10), cand("b", avg=1.06, duration_h=14)])

        assert ids(r.ranked) == ["a", "b"]
        assert r.reason_code == "avg_risk"

    @pytest.mark.parametrize(
        ("avg", "step"), [(0.0, 0), (0.15, 3), (1.02, 20), (1.04, 20), (1.05, 21), (4.0, 80)]
    )
    def test_risk_steps(self, avg: float, step: int) -> None:
        assert risk_step(avg) == step

    def test_miles_compare_rounded(self) -> None:
        r = rank_routes(
            [cand("a", severe=10.4, duration_h=11), cand("b", severe=9.6, duration_h=12)]
        )

        assert ids(r.ranked) == ["a", "b"]  # both round to 10, then time decides
        assert r.reason_code == "duration"

    def test_unknown_average_sorts_after_any_known(self) -> None:
        r = rank_routes([cand("a", avg=None, unknown=800), cand("b", avg=3.9)])

        assert ids(r.ranked) == ["b", "a"]
        assert r.reason == "Lowest average risk (3.90 vs unknown)"


class TestDeterminism:
    def test_identical_routes_order_by_id(self) -> None:
        r1 = rank_routes([cand("r2"), cand("r1"), cand("r3")])
        r2 = rank_routes([cand("r3"), cand("r1"), cand("r2")])

        assert ids(r1.ranked) == ids(r2.ranked) == ["r1", "r2", "r3"]
        assert r1.reason_code == "tie"
        assert r1.reason == "Same risk and travel time as the next route"

    def test_rank_key_shape(self) -> None:
        assert rank_key(cand("x", severe=2.5, high=3.4, avg=0.12)) == (0, 3, 3, 2, 720, "x")


class TestRecommendation:
    def test_nothing_recommended_when_no_route_is_drivable(self) -> None:
        r = rank_routes([cand("a", no_travel=5), cand("b", no_travel=40)])

        assert r.recommended_id is None
        assert r.reason_code == "no_drivable_route"
        assert "later departure" in r.reason
        assert ids(r.ranked) == ["a", "b"]  # still ranked

    def test_single_route(self) -> None:
        r = rank_routes([cand("only")])

        assert r.recommended_id == "only"
        assert r.reason_code == "only_route"

    def test_recommends_the_top_route(self) -> None:
        assert rank_routes([cand("a", severe=1), cand("b")]).recommended_id == "b"

    def test_empty(self) -> None:
        with pytest.raises(ValueError, match="nothing"):
            rank_routes([])


class TestWarnings:
    def test_more_than_a_fifth_unknown_warns(self) -> None:
        r = rank_routes([cand("a", unknown=161), cand("b", unknown=160)])

        assert [(w.code, w.route_id) for w in r.warnings] == [("high_unknown", "a")]
        assert r.warnings[0].message == "No forecast for 20% of this route"


@pytest.mark.parametrize(
    ("seconds", "text"),
    [(60, "1 min"), (25 * 60, "25 min"), (3600, "1 h"), (3900, "1 h 5 min"), (89, "1 min")],
)
def test_format_duration(seconds: float, text: str) -> None:
    assert format_duration(seconds) == text
