from collections.abc import Iterator

import pytest
from django.core.cache import cache
from django.test import override_settings


@pytest.fixture(autouse=True)
def fake_providers() -> Iterator[None]:
    """Tests never reach HERE or Open-Meteo, whatever backend/.env sets.

    Local settings read backend/.env, and a developer trying the real services
    has PROVIDERS=real and a key there; without this, the suite would spend the
    key's monthly allowance. Tests that need other values override these.
    """
    with override_settings(PROVIDERS="fake", FAKE_SCENARIO="demo", HERE_API_KEY=""):
        yield


@pytest.fixture(autouse=True)
def clear_cache() -> Iterator[None]:
    """Forecasts, locks and throttle counters never leak between tests."""
    cache.clear()
    yield
    cache.clear()
