from collections.abc import Iterator

import pytest

from planner.providers import http


@pytest.fixture(autouse=True)
def fresh_breakers() -> Iterator[None]:
    """Each test starts with every provider's breaker closed."""
    http.reset_breakers()
    yield
    http.reset_breakers()


@pytest.fixture(autouse=True)
def no_retry_pause(monkeypatch: pytest.MonkeyPatch) -> None:
    """Retries still happen; the jitter pause before them is zero in tests."""
    monkeypatch.setattr(http, "RETRY_PAUSE_S", (0.0, 0.0))
