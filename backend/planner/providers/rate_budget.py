"""A provider's rate limits, kept on our side so requests stay under them.

Open-Meteo's free API allows 600 calls a minute, 5,000 an hour and 10,000 a
day from one address (so from the whole deployment), and answers 429 past
any of them. One request for many locations is weighed as
`locations x max(1, days / 14) x max(1, variables / 10)` calls, so a batch
of 100 points for 10 days of 6 variables costs 100.

Each window gets 90% of its limit, leaving room for timing differences
between our clock and theirs. Before a request goes out, its weight is
reserved in every window; if any window is full, nothing is reserved and
the caller is told how long to wait.

Counts live in the cache (Redis in production), one key per window and
bucket. A lost or evicted counter can only cause a 429, which the forecast
store handles, never a bill, so unlike the HERE budget (providers/budget.py)
this doesn't need Postgres, and if the cache is unreachable requests go
ahead. Each window's estimate blends in the previous bucket (a sliding
window): `previous x share of the window still to run + current`, so a burst
at the end of one minute and the start of the next can't pass the limit.
Every window is incremented first and checked after, rolled back if over,
so two workers can't both take the last calls (Redis increments are atomic).
"""

import contextlib
import math
import time
from collections.abc import Callable, Sequence
from typing import Final

from django.core.cache import BaseCache, cache

# (window seconds, calls allowed): Open-Meteo's free tier.
OPEN_METEO_FREE: Final = ((60, 600), (3600, 5_000), (86_400, 10_000))
SHARE: Final = 0.9


class OverRate(Exception):
    def __init__(self, retry_after_s: int) -> None:
        super().__init__(f"rate budget full; retry in {retry_after_s} s")
        self.retry_after_s = retry_after_s


def open_meteo_weight(locations: int, days: float, variables: int) -> int:
    """Open-Meteo's cost of one request, in calls, rounded up."""
    return math.ceil(locations * max(1.0, days / 14) * max(1.0, variables / 10))


class RateBudget:
    def __init__(
        self,
        name: str,
        windows: Sequence[tuple[int, int]] = OPEN_METEO_FREE,
        backend: BaseCache = cache,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.name = name
        self.windows = [(seconds, int(limit * SHARE)) for seconds, limit in windows]
        self._cache = backend
        self._clock = clock

    def _key(self, seconds: int, bucket: int) -> str:
        return f"rate:{self.name}:{seconds}:{bucket}"

    def reserve(self, weight: int) -> None:
        """Take `weight` calls from every window, or raise OverRate and take none."""
        now = self._clock()
        taken: list[str] = []
        for seconds, cap in self.windows:
            bucket, into = divmod(now, seconds)
            key = self._key(seconds, int(bucket))
            self._cache.add(key, 0, timeout=seconds * 2)
            try:
                current = self._cache.incr(key, weight)
            except ValueError:
                current = None  # the key vanished or the cache is down
            if current is None:
                continue  # can't count: let the request go (see the module docstring)
            taken.append(key)
            previous = self._cache.get(self._key(seconds, int(bucket) - 1)) or 0
            estimate = previous * (1 - into / seconds) + current
            if estimate > cap:
                for k in taken:
                    self._release(k, weight)
                wait = _wait_s(seconds, into, previous, current - weight, weight, cap)
                raise OverRate(math.ceil(wait - 1e-6))  # 40.0000001 is 40, not 41

    def _release(self, key: str, weight: int) -> None:
        with contextlib.suppress(ValueError):  # expired meanwhile: nothing to give back
            self._cache.decr(key, weight)


def _wait_s(seconds: int, into: float, previous: int, current: int, weight: int, cap: int) -> float:
    """How long until `weight` more fits, if nothing else is taken meanwhile.

    It fits later in this bucket once the previous bucket's share has decayed
    enough; otherwise in the next bucket, where this one becomes the previous.
    """
    room = cap - current - weight
    if previous > 0 and room >= 0:
        # previous x (1 - t / seconds) <= room
        return max(0.0, seconds * (1 - room / previous) - into)
    to_next = seconds - into
    if current <= 0 or weight > cap:
        return to_next
    # In the next bucket: current x (1 - t / seconds) + weight <= cap
    return to_next + max(0.0, seconds * (1 - (cap - weight) / current))
