"""A refused CSRF check as the API's JSON error (RFC §11), not Django's HTML page.

Django calls this for views it checks itself, such as allauth's endpoints
under /api/auth/. DRF's own views report the same failure as a 403
`permission_denied` through the API's exception handler.
"""

from django.http import HttpRequest, JsonResponse

from planner.api.errors import error_body


def csrf_failure(request: HttpRequest, reason: str = "") -> JsonResponse:
    return JsonResponse(
        error_body(
            "csrf_failed",
            "This page's security token is missing or out of date. Reload and try again.",
        ),
        status=403,
    )
