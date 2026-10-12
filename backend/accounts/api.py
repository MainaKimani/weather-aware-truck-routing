"""The caller's account (RFC §7.5). Sign-up, login and logout are allauth's,
under /api/auth/; this is what the app itself needs to know."""

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.serializers import MeSerializer
from planner.access import current_owner, owned_trips


class MeView(APIView):
    """Who the caller is: a signed-in user, a guest who has planned, or neither.

    The app asks this first, so the response also sets the CSRF cookie that
    every later sign-up, login or plan sends back as `X-CSRFToken`.
    """

    permission_classes = (AllowAny,)

    @extend_schema(operation_id="get_me", responses={200: MeSerializer})
    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request) -> Response:
        owner = current_owner(request)
        user = request.user
        return Response(
            {
                "user": {"email": user.email} if user.is_authenticated else None,
                "guest": owner is not None and owner.is_guest,
                "recent_trip_count": owned_trips(owner).count(),
            }
        )
