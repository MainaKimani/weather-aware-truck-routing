import uuid
from typing import Any

from django.db import IntegrityError
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from planner.access import Owner, current_owner, get_owned_trip, get_visible_trip, owned_trips
from planner.api.errors import AccountRequired, IdempotencyConflict
from planner.api.pagination import TripCursorPagination
from planner.api.serializers import (
    ErrorSerializer,
    HeatmapQuerySerializer,
    HeatmapSerializer,
    PlaceOutSerializer,
    PlanRequestSerializer,
    PlanSerializer,
    PlanSnapshotSerializer,
    SuggestQuerySerializer,
    TripListQuerySerializer,
    TripPageSerializer,
    TripSerializer,
    TripSummarySerializer,
    TripUpdateSerializer,
)
from planner.api.throttles import PlanGuestSessionThrottle, PlanGuestThrottle, PlanUserThrottle
from planner.models import Trip
from planner.providers.registry import get_providers
from planner.repositories import (
    load_heatmap,
    load_snapshot,
    load_trip,
    replan_request,
    route_lines,
    save_heatmap,
    save_trip,
    summaries,
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
            503: _error("quota_reached: live routing has used this month's allowance"),
        },
    )
    def post(self, request: Request) -> Response:
        return Response(load_snapshot(_plan_and_save(request, request.data)))


def _plan_and_save(request: Request, data: Any, replanned_from: Trip | None = None) -> Trip:
    """Plan from request data and save the trip for the caller, once per Idempotency-Key.

    A caller with neither an account nor a guest id becomes a guest here, and
    only once the plan has succeeded, so a failed request leaves no trace.
    """
    key = _idempotency_key(request)
    if key and (earlier := trip_for_key(key)):
        return _replay(earlier, current_owner(request))

    serializer = PlanRequestSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    plan = plan_trip(serializer.to_request(), get_providers())
    snapshot = PlanSnapshotSerializer(plan).data
    owner = current_owner(request, create=True)
    try:
        return save_trip(snapshot, owner, key, replanned_from)
    except IntegrityError:
        # The same key, saved by a concurrent request since the check above.
        earlier = trip_for_key(key) if key else None
        if earlier is None:
            raise
        return _replay(earlier, owner)


def _idempotency_key(request: Request) -> uuid.UUID | None:
    raw = request.headers.get(IDEMPOTENCY_HEADER)
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise ValidationError({IDEMPOTENCY_HEADER: ["Must be a UUID."]}) from exc


def _replay(trip: Trip, owner: Owner | None) -> Trip:
    """The trip an earlier request with this key created, if it was the caller's."""
    if owner is None or not owner.owns(trip):
        raise IdempotencyConflict
    return trip


# How many trips a guest's list shows: their recent ones on this device (PRD §7.9).
GUEST_LIST_LIMIT = 20


class TripListView(APIView):
    """The caller's trips, newest first.

    Signed-in users page through all of theirs with the cursor in `next`.
    A guest gets their latest 20 and no further pages. A visitor who hasn't
    planned yet gets an empty list.
    """

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "trips"

    @extend_schema(
        operation_id="list_trips",
        parameters=[TripListQuerySerializer],
        responses={
            200: TripPageSerializer,
            400: _error("invalid_input"),
            429: _error("rate_limited"),
        },
    )
    def get(self, request: Request) -> Response:
        query = TripListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        owner = current_owner(request)
        trips = summaries(
            owned_trips(owner), saved=query.validated_data["saved"], q=query.validated_data["q"]
        )
        if owner is None or owner.is_guest:
            page = TripSummarySerializer(trips[:GUEST_LIST_LIMIT], many=True).data
            return Response({"next": None, "previous": None, "results": page})
        paginator = TripCursorPagination()
        results = paginator.paginate_queryset(trips, request, view=self) or []
        return paginator.get_paginated_response(TripSummarySerializer(results, many=True).data)


class TripDetailView(APIView):
    """A saved trip: the plan as it was made, for its owner or, if shared, anyone."""

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "trips"

    @extend_schema(
        operation_id="get_trip",
        parameters=[OpenApiParameter("trip_id", uuid.UUID, OpenApiParameter.PATH)],
        responses={
            200: TripSerializer,
            404: _error("not_found: no such trip, or not yours and not shared"),
            429: _error("rate_limited"),
        },
    )
    def get(self, request: Request, trip_id: str) -> Response:
        owner = current_owner(request)
        return Response(load_trip(get_visible_trip(trip_id, owner), owner))

    @extend_schema(
        operation_id="update_trip",
        parameters=[OpenApiParameter("trip_id", uuid.UUID, OpenApiParameter.PATH)],
        request=TripUpdateSerializer,
        responses={
            200: TripSerializer,
            400: _error("invalid_input"),
            403: _error("account_required: only signed-in users save trips"),
            404: _error("not_found: no such trip, or not yours (sharing doesn't let others edit)"),
            429: _error("rate_limited"),
        },
    )
    def patch(self, request: Request, trip_id: str) -> Response:
        owner = current_owner(request)
        trip = get_owned_trip(trip_id, owner)
        update = TripUpdateSerializer(data=request.data, partial=True)
        update.is_valid(raise_exception=True)
        changes = update.validated_data
        if "saved" in changes and trip.user_id is None:
            raise AccountRequired
        for field, value in changes.items():
            setattr(trip, field, value)
        trip.save(update_fields=[*changes])
        return Response(load_trip(trip, owner))

    @extend_schema(
        operation_id="delete_trip",
        parameters=[OpenApiParameter("trip_id", uuid.UUID, OpenApiParameter.PATH)],
        responses={
            204: None,
            404: _error("not_found: no such trip, or not yours"),
            429: _error("rate_limited"),
        },
    )
    def delete(self, request: Request, trip_id: str) -> Response:
        get_owned_trip(trip_id, current_owner(request)).delete()  # routes and heatmap cascade
        return Response(status=204)


class TripReplanView(APIView):
    """Plan the trip again with current weather: the same places, load, interval
    and HOS clocks, leaving now if the original departure has passed.

    The new trip belongs to the caller, so anyone who can open a shared trip
    can re-plan it into their own. It records which trip it came from.
    """

    permission_classes = (AllowAny,)
    throttle_classes = (PlanGuestThrottle, PlanGuestSessionThrottle, PlanUserThrottle)

    @extend_schema(
        operation_id="replan_trip",
        request=None,
        parameters=[
            OpenApiParameter("trip_id", uuid.UUID, OpenApiParameter.PATH),
            OpenApiParameter(
                IDEMPOTENCY_HEADER,
                uuid.UUID,
                OpenApiParameter.HEADER,
                required=False,
                description="A UUID per click; a repeat returns the same new trip.",
            ),
        ],
        responses={
            200: TripSerializer,
            400: _error("invalid_input: the trip's inputs no longer make a valid plan"),
            404: _error("not_found: no such trip, or not yours and not shared"),
            409: _error("idempotency_conflict: the key belongs to another caller's trip"),
            422: _error("no_route: no truck route between the places"),
            429: _error("rate_limited"),
            502: _error("routing_unavailable or weather_unavailable"),
            503: _error("quota_reached: live routing has used this month's allowance"),
        },
    )
    def post(self, request: Request, trip_id: str) -> Response:
        source = get_visible_trip(trip_id, current_owner(request))
        trip = _plan_and_save(
            request, replan_request(source, timezone.now()), replanned_from=source
        )
        return Response(load_trip(trip, current_owner(request)))


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
        parameters=[
            OpenApiParameter("trip_id", uuid.UUID, OpenApiParameter.PATH),
            HeatmapQuerySerializer,
        ],
        responses={
            200: HeatmapSerializer,
            404: _error("not_found: no such trip, or not yours and not shared"),
            429: _error("rate_limited"),
            502: _error("weather_unavailable"),
        },
    )
    def get(self, request: Request, trip_id: str) -> Response:
        query = HeatmapQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        include_metrics = query.validated_data.get("include") == "metrics"
        trip = get_visible_trip(trip_id, current_owner(request))
        saved = load_heatmap(trip, include_metrics=include_metrics)
        if saved is not None:
            return Response(saved)
        weather = get_providers().weather
        grid = corridor_grid(route_lines(trip), trip.load_lb, ForecastStore(weather))
        # Kept with its metrics, so asking for them later reads the same copy.
        computed = HeatmapSerializer(grid, context={"include_metrics": True}).data
        return Response(save_heatmap(trip, computed, include_metrics=include_metrics))


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
            503: _error("quota_reached: place search has used this month's allowance"),
        },
    )
    def get(self, request: Request) -> Response:
        query = SuggestQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        places = suggest(get_providers().geocoder, query.validated_data["q"])
        return Response([PlaceOutSerializer(p).data for p in places])
