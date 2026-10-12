"""The caller's account (RFC §7.5). Sign-up, login and logout are allauth's,
under /api/auth/; this is what the app itself needs to know."""

from typing import Any

from django.contrib.auth import logout
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.serializers import DeleteAccountSerializer, MeSerializer
from planner.access import current_owner, owned_trips
from planner.api.serializers import ErrorSerializer


class MeView(APIView):
    """Who the caller is: a signed-in user, a guest who has planned, or neither.

    The app asks this first, so the response also sets the CSRF cookie that
    every later sign-up, login or plan sends back as `X-CSRFToken`.
    """

    # Deletion checks the password, a guessing target, so it has its own tight limit.
    throttle_scope = "delete_account"

    def get_permissions(self) -> list[Any]:
        # Anyone may ask who they are; only a signed-in user can delete their account.
        return [IsAuthenticated()] if self.request.method == "DELETE" else [AllowAny()]

    def get_throttles(self) -> list[Any]:
        return [ScopedRateThrottle()] if self.request.method == "DELETE" else []

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

    @extend_schema(
        operation_id="delete_me",
        request=DeleteAccountSerializer,
        responses={
            204: None,
            400: OpenApiResponse(ErrorSerializer, description="invalid_input: wrong password"),
            403: OpenApiResponse(ErrorSerializer, description="not_authenticated"),
            429: OpenApiResponse(ErrorSerializer, description="rate_limited"),
        },
    )
    def delete(self, request: Request) -> Response:
        """Delete the account and everything in it, then end the session.

        Needs the password, so a session left open on a shared computer can't
        be used to delete someone's account. The user's trips, their routes
        and heatmaps, and allauth's email records all go with the user.
        """
        body = DeleteAccountSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(body.validated_data["password"]):
            raise serializers.ValidationError({"password": ["The password is not correct."]})
        with transaction.atomic():
            user.delete()
        logout(request)
        return Response(status=204)
