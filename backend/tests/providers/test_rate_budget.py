import threading

import pytest
from django.core.cache import cache

from planner.providers.rate_budget import (
    OPEN_METEO_FREE,
    OverRate,
    RateBudget,
    open_meteo_weight,
)

MINUTE = 60 * 16_667.0  # the start of some minute


class Clock:
    def __init__(self, t: float = MINUTE + 20) -> None:  # 20 s into a minute
        self.t = t

    def __call__(self) -> float:
        return self.t


def budget(clock: Clock, windows: list[tuple[int, int]] | None = None) -> RateBudget:
    return RateBudget("test", windows or [(60, 100)], clock=clock)  # cap 90 a minute


def test_weight_follows_open_meteos_rules() -> None:
    assert open_meteo_weight(100, days=10, variables=6) == 100  # under both thresholds
    assert open_meteo_weight(100, days=28, variables=6) == 200  # four weeks: double
    assert open_meteo_weight(10, days=14, variables=15) == 15  # 15 variables: one and a half
    assert open_meteo_weight(1, days=1, variables=1) == 1


def test_each_window_gets_90_percent_of_the_free_tier() -> None:
    assert RateBudget("x").windows == [(60, 540), (3600, 4500), (86_400, 9000)]
    assert OPEN_METEO_FREE == ((60, 600), (3600, 5_000), (86_400, 10_000))


def test_reserves_up_to_the_cap_then_refuses_without_taking_anything() -> None:
    clock = Clock()
    b = budget(clock)
    b.reserve(50)
    b.reserve(40)

    with pytest.raises(OverRate) as raised:
        b.reserve(1)

    # 40 s to the next minute, where this one still weighs 90 x (1 - t/60): one more
    # call fits at t = 0.7 s.
    assert raised.value.retry_after_s == 41
    clock.t += 60 * 2  # two minutes on: nothing left over from this one
    b.reserve(90)


def test_a_refused_request_takes_nothing_from_any_window() -> None:
    clock = Clock()
    b = budget(clock, [(60, 100), (3600, 1000)])  # 90 a minute, 900 an hour
    b.reserve(80)

    with pytest.raises(OverRate):
        b.reserve(20)  # fits the hour, not the minute

    clock.t += 120
    b.reserve(90)
    hour_key = f"rate:test:3600:{int(clock.t // 3600)}"
    assert cache.get(hour_key) == 170  # 80 + 90; the refused 20 was given back


def test_the_previous_minute_still_counts_for_a_while() -> None:
    clock = Clock(MINUTE + 50)
    b = budget(clock)
    b.reserve(90)
    clock.t += 15  # 5 s into the next minute: the last one still weighs 90 x 55/60

    with pytest.raises(OverRate) as raised:
        b.reserve(30)

    # It fits once 90 x (1 - t/60) + 30 <= 90, at t = 20 s: 15 s from now.
    assert raised.value.retry_after_s == 15
    clock.t += 15
    b.reserve(30)


def test_a_full_hour_waits_for_the_hour() -> None:
    clock = Clock(3600 * 500 + 600.0)  # 10 minutes into an hour
    b = budget(clock, [(60, 1000), (3600, 100)])  # 900 a minute, 90 an hour
    b.reserve(90)

    with pytest.raises(OverRate) as raised:
        b.reserve(10)

    assert 3000 <= raised.value.retry_after_s <= 3600 + 600


def test_concurrent_reservations_never_pass_the_cap() -> None:
    b = budget(Clock())
    start = threading.Barrier(30)
    taken: list[int] = []

    def worker() -> None:
        start.wait()
        try:
            b.reserve(10)
            taken.append(10)
        except OverRate:
            pass

    threads = [threading.Thread(target=worker) for _ in range(30)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sum(taken) == 90


def test_an_unreachable_cache_lets_requests_through() -> None:
    class Down:
        def add(self, *args: object, **kwargs: object) -> None:
            return None

        def incr(self, key: str, delta: int = 1) -> int:
            raise ValueError("no such key")

        def get(self, key: str) -> None:
            return None

    b = RateBudget("test", [(60, 10)], backend=Down(), clock=Clock())  # type: ignore[arg-type]

    for _ in range(5):
        b.reserve(100)  # far over the cap, but nothing can be counted
