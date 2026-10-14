"""The one HTTP client every provider adapter uses (RFC §18.3).

- Timeouts: 3 s connect, 10 s read, so no outbound call can hang a worker.
- Retries: once, after a short random pause, and only on timeouts, transport
  errors and 5xx. Every call here is an idempotent GET. A 4xx means the
  request itself is wrong, so it is never retried.
- Circuit breaker per provider: after 5 failed calls in a row the provider is
  skipped for 30 s, so an outage fails fast instead of every request waiting
  out its timeouts. The next call after that is a trial: success closes the
  breaker, failure opens it for another 30 s.
- Meter (optional): called before every request, the retry included, so a
  metered service is charged for each request it receives. When the meter
  refuses (raises a ProviderError), the first request isn't made, and a
  failed request isn't retried.

Breakers are per process and shared by name, because adapters are created
per request. This is the API's only in-process state (RFC §18.2).
"""

import logging
import random
import threading
import time
from collections.abc import Callable
from typing import Any, Final

import httpx

from planner.providers.base import ProviderError

TIMEOUT: Final = httpx.Timeout(10.0, connect=3.0)
FAILURE_THRESHOLD: Final = 5
OPEN_FOR_S: Final = 30.0
RETRY_PAUSE_S: Final = (0.1, 0.4)

logger = logging.getLogger("planner.providers")


class HttpError(ProviderError):
    """A non-2xx response, a transport failure, a body that isn't JSON, or an open breaker."""

    def __init__(self, message: str, status: int | None = None, retryable: bool = False) -> None:
        super().__init__(message)
        self.status = status
        self.retryable = retryable


class CircuitOpen(HttpError):
    pass


class CircuitBreaker:
    def __init__(
        self,
        threshold: int = FAILURE_THRESHOLD,
        open_for_s: float = OPEN_FOR_S,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.threshold = threshold
        self.open_for_s = open_for_s
        self._clock = clock
        self._lock = threading.Lock()
        self._failures = 0
        self._opened_at: float | None = None
        self._trial_running = False

    @property
    def state(self) -> str:
        with self._lock:
            return self._state()

    def _state(self) -> str:
        if self._opened_at is None:
            return "closed"
        if self._clock() - self._opened_at < self.open_for_s:
            return "open"
        return "half_open"

    def allow(self) -> bool:
        """Whether a call may go out now. In half-open, only one trial at a time."""
        with self._lock:
            state = self._state()
            if state == "closed":
                return True
            if state == "half_open" and not self._trial_running:
                self._trial_running = True
                return True
            return False

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None
            self._trial_running = False

    def release(self) -> None:
        """A call that was allowed but never made: let the next one be the trial."""
        with self._lock:
            self._trial_running = False

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._trial_running or self._failures >= self.threshold:
                self._opened_at = self._clock()
            self._trial_running = False


_breakers: dict[str, CircuitBreaker] = {}
_breakers_lock = threading.Lock()


def breaker_for(name: str) -> CircuitBreaker:
    with _breakers_lock:
        if name not in _breakers:
            _breakers[name] = CircuitBreaker()
        return _breakers[name]


def reset_breakers() -> None:
    """For tests."""
    with _breakers_lock:
        _breakers.clear()


class HttpClient:
    def __init__(
        self,
        name: str,
        client: httpx.Client | None = None,
        breaker: CircuitBreaker | None = None,
        sleep: Callable[[float], None] = time.sleep,
        meter: Callable[[], None] | None = None,
    ) -> None:
        self.name = name
        self._client = client or httpx.Client(timeout=TIMEOUT)
        self._breaker = breaker or breaker_for(name)
        self._sleep = sleep
        self._meter = meter

    def get_json(self, url: str, params: Any) -> Any:
        """GET and parse JSON. Logs one line per call; never the URL's query (keys)."""
        if not self._breaker.allow():
            self._log(logging.WARNING, "circuit_open", 0, 0.0)
            raise CircuitOpen(f"{self.name}: temporarily unavailable (circuit open)")
        try:
            self._charge()
        except ProviderError:
            self._breaker.release()
            self._log(logging.WARNING, "over_budget", 0, 0.0)
            raise
        started = time.perf_counter()
        attempts = [0]
        try:
            body = self._get_with_retry(url, params, attempts)
        except HttpError as exc:
            # A 4xx is our mistake, not the provider failing, so it doesn't count.
            if exc.retryable:
                self._breaker.record_failure()
            else:
                self._breaker.record_success()
            self._log(logging.WARNING, "error", attempts[0], started, exc.status, str(exc))
            raise
        self._breaker.record_success()
        self._log(logging.INFO, "ok", attempts[0], started)
        return body

    def _log(
        self,
        level: int,
        outcome: str,
        attempts: int,
        started: float,
        status: int | None = None,
        error: str | None = None,
    ) -> None:
        elapsed_ms = round((time.perf_counter() - started) * 1000) if started else 0
        logger.log(
            level,
            "%s call %s",
            self.name,
            outcome,
            extra={
                "provider": self.name,
                "outcome": outcome,
                "attempts": attempts,
                "duration_ms": elapsed_ms,
                "status": status,
                "error": error,
            },
        )

    def _get_with_retry(self, url: str, params: Any, attempts: list[int]) -> Any:
        try:
            attempts[0] += 1
            return self._get_once(url, params)
        except HttpError as exc:
            if not exc.retryable or not self._may_charge():
                raise
        self._sleep(random.uniform(*RETRY_PAUSE_S))  # noqa: S311 - jitter, not security
        attempts[0] += 1
        return self._get_once(url, params)

    def _charge(self) -> None:
        if self._meter is not None:
            self._meter()

    def _may_charge(self) -> bool:
        try:
            self._charge()
        except ProviderError:
            return False
        return True

    def _get_once(self, url: str, params: Any) -> Any:
        try:
            response = self._client.get(url, params=params)
        except httpx.TimeoutException as exc:
            raise HttpError(f"{self.name}: timed out", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise HttpError(f"{self.name}: {type(exc).__name__}", retryable=True) from exc
        if response.status_code >= 500:
            raise HttpError(
                f"{self.name}: HTTP {response.status_code}", response.status_code, retryable=True
            )
        if response.status_code >= 400:
            raise HttpError(f"{self.name}: HTTP {response.status_code}", response.status_code)
        try:
            return response.json()
        except ValueError as exc:
            raise HttpError(f"{self.name}: response is not JSON") from exc
