"""The one HTTP client every provider adapter uses.

Timeouts are set here so no outbound call can hang a worker (RFC §18.3).
Retries and the circuit breaker are added in SPOT-36.
"""

from typing import Any, Final

import httpx

from planner.providers.base import ProviderError

TIMEOUT: Final = httpx.Timeout(10.0, connect=3.0)


class HttpError(ProviderError):
    """A non-2xx response, a transport failure or a body that isn't JSON."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class HttpClient:
    def __init__(self, name: str, client: httpx.Client | None = None) -> None:
        self.name = name
        self._client = client or httpx.Client(timeout=TIMEOUT)

    def get_json(self, url: str, params: Any) -> Any:
        try:
            response = self._client.get(url, params=params)
        except httpx.TimeoutException as exc:
            raise HttpError(f"{self.name}: timed out") from exc
        except httpx.HTTPError as exc:
            raise HttpError(f"{self.name}: {type(exc).__name__}") from exc
        if response.status_code >= 400:
            raise HttpError(f"{self.name}: HTTP {response.status_code}", response.status_code)
        try:
            return response.json()
        except ValueError as exc:
            raise HttpError(f"{self.name}: response is not JSON") from exc
