from collections.abc import Iterator

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache() -> Iterator[None]:
    """Forecasts, locks and throttle counters never leak between tests."""
    cache.clear()
    yield
    cache.clear()
