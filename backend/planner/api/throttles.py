"""Request rate limits (RFC §12). Rates live in settings (`DEFAULT_THROTTLE_RATES`).

Counters are in the default cache (Redis in production), so they hold across
workers. Guests are counted twice, by client IP and by the guest id in their
session, so neither changing network nor clearing cookies resets the count;
signed-in users are counted by account. Other views set `throttle_scope`
and use DRF's ScopedRateThrottle (geocode, heatmap).
"""

from django.http import HttpRequest
from rest_framework.request import Request
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from planner.access import GUEST_KEY


class PlanGuestThrottle(AnonRateThrottle):
    """10 plans a minute per guest IP. Doesn't apply to signed-in users."""

    scope = "plans_guest"


class PlanGuestSessionThrottle(SimpleRateThrottle):
    """The same 10 a minute per guest id, wherever the guest connects from."""

    scope = "plans_guest"

    def get_cache_key(self, request: Request | HttpRequest, view: APIView) -> str | None:
        if request.user and request.user.is_authenticated:
            return None
        guest_id = request.session.get(GUEST_KEY)
        if not guest_id:
            return None  # not a guest yet; the IP limit still applies
        return self.cache_format % {"scope": self.scope, "ident": f"guest:{guest_id}"}


class PlanUserThrottle(UserRateThrottle):
    """30 plans a minute per account. Guests also hit the tighter guest limit first."""

    scope = "plans_user"
