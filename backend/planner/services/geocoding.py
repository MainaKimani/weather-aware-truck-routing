"""Place suggestions for the trip form, cached by query (RFC §7.1, §9).

Queries are normalised (trimmed, lower case, inner spaces collapsed) so
"Dallas", " dallas " and "DALLAS" share one entry, and hashed for the key,
since cache keys can't hold arbitrary user text. Results are kept 7 days,
since places rarely change and every miss is a metered HERE call; failures
aren't cached.
"""

import hashlib
from typing import Any, Final

from django.core.cache import BaseCache, cache

from planner.domain.types import LatLon
from planner.providers.base import Geocoder, Place

MIN_QUERY: Final = 3
LIMIT: Final = 5
TTL_S: Final = 7 * 24 * 3600
SCHEMA_VERSION: Final = 1


def normalise(query: str) -> str:
    return " ".join(query.split()).lower()


def cache_key(query: str) -> str:
    digest = hashlib.sha256(normalise(query).encode()).hexdigest()[:32]
    return f"geo{SCHEMA_VERSION}:{digest}"


def _encode(places: list[Place]) -> list[dict[str, Any]]:
    return [
        {"label": p.label, "lat": p.position.lat, "lon": p.position.lon, "tz": p.tz} for p in places
    ]


def _decode(value: list[dict[str, Any]]) -> list[Place]:
    return [Place(v["label"], LatLon(v["lat"], v["lon"]), v["tz"]) for v in value]


def suggest(geocoder: Geocoder, query: str, backend: BaseCache = cache) -> list[Place]:
    """Up to five places for a partial query; fewer than 3 characters gives none."""
    q = normalise(query)
    if len(q) < MIN_QUERY:
        return []
    key = cache_key(q)
    cached = backend.get(key)
    if cached is not None:
        return _decode(cached)
    places = geocoder.suggest(q, LIMIT)
    backend.set(key, _encode(places), TTL_S)
    return places
