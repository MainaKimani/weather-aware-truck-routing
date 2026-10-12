"""Request rate limits (RFC §12). Rates live in settings (`DEFAULT_THROTTLE_RATES`).

Counters are in the default cache (Redis in production), so they hold across
workers. Guests are counted by client IP until guest sessions exist;
signed-in users by account. Other views set `throttle_scope`
and use DRF's ScopedRateThrottle (geocode, heatmap).
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class PlanGuestThrottle(AnonRateThrottle):
    """10 plans a minute for a guest. Doesn't apply to signed-in users."""

    scope = "plans_guest"


class PlanUserThrottle(UserRateThrottle):
    """30 plans a minute per account. Guests also hit the tighter guest limit first."""

    scope = "plans_user"
