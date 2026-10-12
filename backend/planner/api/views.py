import uuid

from django.db import IntegrityError
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from planner.access import Owner, current_owner, get_visible_trip
from planner.api.errors import IdempotencyConflict
from planner.api.serializers import (
    ErrorSerializer,
    HeatmapSerializer,
    PlaceOutSerializer,
    PlanRequestSerializer,
    PlanSerializer,
    PlanSnapshotSerializer,
    SuggestQuerySerializer,
)
from planner.api.throttles import PlanGuestSessionThrottle, PlanGuestThrottle, PlanUserThrottle
from planner.models import Trip
from planner.providers.registry import get_providers
from planner.repositories import (
    Snapshot,
    load_heatmap,
    load_snapshot,
    route_lines,
    save_heatmap,
    save_trip,
    trip_for_key,
)
from planner.services.corridor import corridor_grid
from planner.services.forecasts import ForecastStore
from planner.services.geocoding import suggest
from planner.services.plan import plan_trip


def _error(description: str) -> OpenApiResponse:
    return OpenApiResponse(ErrorSerializer, description=description)


IDEMPOTENCY_HEADER = "Idempotency-Key"


class PlanView(APIView):
    """Plan a trip: three routes rated for weather risk, and a recommendation.

    The plan is saved as a trip owned by the caller (a new guest on their
    first plan) and the saved snapshot is returned. A repeat with the same
    `Idempotency-Key` returns the trip that key created instead of planning
    again.
    """

    permission_classes = (AllowAny,)
    throttle_classes = (PlanGuestThrottle, PlanGuestSessionThrottle, PlanUserThrottle)

    @extend_schema(
        operation_id="create_plan",
        request=PlanRequestSerializer,
        parameters=[
            OpenApiParameter(
                IDEMPOTENCY_HEADER,
                uuid.UUID,
                OpenApiParameter.HEADER,
                required=False,
                description="A UUID per form submission; a repeat returns the same trip.",
            )
        ],
        responses={
            200: PlanSerializer,
            400: _error("invalid_input: a field is missing or out of range"),
            409: _error("idempotency_conflict: the key belongs to another caller's trip"),
            422: _error("no_route: no truck route between the places"),
            429: _error("rate_limited"),
            502: _error("routing_unavailable or weather_unavailable"),
        },
    )
    def post(self, request: Request) -> Response:
        key = _idempotency_key(request)
        if key and (earlier := trip_for_key(key)):
            return Response(_replay(earlier, current_owner(request)))

        serializer = PlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = plan_trip(serializer.to_request(), get_providers())
        snapshot = PlanSnapshotSerializer(plan).data
        owner = current_owner(request, create=True)
        try:
            trip = save_trip(snapshot, owner, key)
        except IntegrityError:
            # The same key, saved by a concurrent request since the check above.
            earlier = trip_for_key(key) if key else None
            if earlier is None:
                raise
            return Response(_replay(earlier, owner))
        return Response(load_snapshot(trip))


def _idempotency_key(request: Request) -> uuid.UUID | None:
    raw = request.headers.get(IDEMPOTENCY_HEADER)
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise ValidationError({IDEMPOTENCY_HEADER: ["Must be a UUID."]}) from exc


def _replay(trip: Trip, owner: Owner | None) -> Snapshot:
    """The trip an earlier request with this key created, if it was the caller's."""
    if owner is None or not owner.owns(trip):
        raise IdempotencyConflict
    return load_snapshot(trip)


class TripHeatmapView(APIView):
    """The trip's corridor heatmap: risk around its routes for each of the next 48 hours.

    Computed from the saved routes and load on the first request, then kept,
    so a reopened trip shows the heatmap as it was. Visible to whoever can see
    the trip.
    """

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "heatmap"

    @extend_schema(
        operation_id="trip_heatmap",
        parameters=[OpenApiParameter("trip_id", uuid.UUID, OpenApiParameter.PATH)],
        responses={
            200: HeatmapSerializer,
            404: _error("not_found: no such trip, or not yours and not shared"),
            429: _error("rate_limited"),
            502: _error("weather_unavailable"),
        },
    )
    def get(self, request: Request, trip_id: str) -> Response:
        trip = get_visible_trip(trip_id, current_owner(request))
        saved = load_heatmap(trip)
        if saved is not None:
            return Response(saved)
        weather = get_providers().weather
        grid = corridor_grid(route_lines(trip), trip.load_lb, ForecastStore(weather))
        return Response(save_heatmap(trip, HeatmapSerializer(grid).data))


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
