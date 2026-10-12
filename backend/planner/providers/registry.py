"""Chooses fake or real providers from settings (`PROVIDERS`)."""

from dataclasses import dataclass
from typing import cast

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from planner.providers.base import Geocoder, RoutingProvider, WeatherProvider
from planner.providers.fakes import FakeGeocoder, FakeRouting, FakeWeather, Scenario
from planner.providers.here import HereRouting
from planner.providers.here_geocoder import HereGeocoder
from planner.providers.open_meteo import OpenMeteoWeather


@dataclass(frozen=True)
class Providers:
    routing: RoutingProvider
    weather: WeatherProvider
    geocoder: Geocoder
    demo: bool  # responses say so when fake data is in use


def get_providers() -> Providers:
    mode = settings.PROVIDERS
    if mode == "fake":
        scenario = settings.FAKE_SCENARIO
        if scenario not in ("demo", "strong"):
            raise ImproperlyConfigured(f"FAKE_SCENARIO must be demo or strong, not {scenario!r}")
        return Providers(
            FakeRouting(), FakeWeather(cast(Scenario, scenario)), FakeGeocoder(), demo=True
        )
    if mode == "real":
        key = settings.HERE_API_KEY
        if not key:
            raise ImproperlyConfigured("PROVIDERS=real needs HERE_API_KEY")
        return Providers(HereRouting(key), OpenMeteoWeather(), HereGeocoder(key), demo=False)
    raise ImproperlyConfigured(f"PROVIDERS must be fake or real, not {mode!r}")
