from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from planner.api.serializers import (
    ErrorSerializer,
    PlaceOutSerializer,
    PlanRequestSerializer,
    PlanSerializer,
    SuggestQuerySerializer,
)
from planner.api.throttles import PlanGuestSessionThrottle, PlanGuestThrottle, PlanUserThrottle
from planner.providers.registry import get_providers
from planner.services.geocoding import suggest
from planner.services.plan import plan_trip


def _error(description: str) -> OpenApiResponse:
    return OpenApiResponse(ErrorSerializer, description=description)


class PlanView(APIView):
    """Plan a trip: three routes rated for weather risk, and a recommendation."""

    permission_classes = (AllowAny,)
    throttle_classes = (PlanGuestThrottle, PlanGuestSessionThrottle, PlanUserThrottle)

    @extend_schema(
        operation_id="create_plan",
        request=PlanRequestSerializer,
        responses={
            200: PlanSerializer,
            400: _error("invalid_input: a field is missing or out of range"),
            422: _error("no_route: no truck route between the places"),
            429: _error("rate_limited"),
            502: _error("routing_unavailable or weather_unavailable"),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = PlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = plan_trip(serializer.to_request(), get_providers())
        return Response(PlanSerializer(plan).data)


class GeocodeSuggestView(APIView):
    """Places matching a partial query, for the origin and destination fields."""

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "geocode"

    @extend_schema(
        operation_id="suggest_places",
        parameters=[
            OpenApiParameter(
                "q",
                str,
                required=True,
                description="Partial place name; under 2 characters gives [].",
            )
        ],
        responses={
            200: PlaceOutSerializer(many=True),
            400: _error("invalid_input: q missing or over 100 characters"),
            429: _error("rate_limited"),
            502: _error("geocoding_unavailable"),
        },
    )
    def get(self, request: Request) -> Response:
        query = SuggestQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        places = suggest(get_providers().geocoder, query.validated_data["q"])
        return Response([PlaceOutSerializer(p).data for p in places])
