"""Request validation and response shape for the plan API (RFC §7.2).

Input serializers validate and build domain requests; output serializers
read domain objects directly, so there is one definition of the JSON shape
and the OpenAPI schema is generated from it.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, ClassVar, Final, get_args
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from planner.domain.geo import haversine_mi
from planner.domain.hos import DEFAULT_RULES, Cycle, HosClocks, PlacedStop, StopKind, StopReason
from planner.domain.polyline import encode
from planner.domain.ranking import RISK_AVG_TOLERANCE, ReasonCode
from planner.domain.risk import Condition, Level, LoadRule
from planner.domain.sampling import ALLOWED_INTERVALS_MI
from planner.domain.types import LatLon
from planner.providers.base import Place
from planner.services.corridor import HeatmapGrid
from planner.services.plan import Plan, PlanRequest, WarningCode

MAX_LOAD_LB: Final = 80_000
DEPARTURE_PAST: Final = timedelta(minutes=15)
DEPARTURE_FUTURE: Final = timedelta(days=7)
MIN_TRIP_MI: Final = 1.0
CYCLES: Final = {"70h_8d": Cycle.H70_8D, "60h_7d": Cycle.H60_7D}
HOUR: Final = 3600

# --- Input -------------------------------------------------------------------


class AwareDateTimeField(serializers.DateTimeField):
    """An ISO 8601 date-time that must carry a UTC offset ("Z" or "+hh:mm").

    A bare local time is ambiguous for a trip that crosses time zones, so it
    is rejected rather than guessed.
    """

    default_error_messages: ClassVar[dict[str, str]] = {  # type: ignore[assignment]
        "naive": "Include a UTC offset, e.g. 2026-10-12T06:00:00-05:00.",
    }

    def to_internal_value(self, value: Any) -> datetime:
        if isinstance(value, str):
            parsed = parse_datetime(value.strip())
            if parsed is not None and timezone.is_naive(parsed):
                self.fail("naive")
        return super().to_internal_value(value)


class PlaceInSerializer(serializers.Serializer[Place]):
    class Meta:
        ref_name = "Place"

    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    label = serializers.CharField(max_length=200)  # type: ignore[assignment]  # Field.label
    tz = serializers.CharField(max_length=64, required=False, allow_null=True, default=None)

    def validate_tz(self, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise serializers.ValidationError("Not a known IANA time zone.") from exc
        return value


def _hours(max_h: int) -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=4,
        decimal_places=2,
        min_value=Decimal(0),
        max_value=Decimal(max_h),
        required=False,
    )


class HosInSerializer(serializers.Serializer[dict[str, Any]]):
    """The driver's ELD clocks, in hours remaining (PRD §7.3.1)."""

    class Meta:
        ref_name = "Hos"

    enabled = serializers.BooleanField(default=False)
    cycle = serializers.ChoiceField(choices=list(CYCLES), required=False)
    drive_left_h = _hours(DEFAULT_RULES.max_drive_s // HOUR)
    window_left_h = _hours(DEFAULT_RULES.window_s // HOUR)
    until_break_h = _hours(DEFAULT_RULES.drive_before_break_s // HOUR)
    cycle_left_h = _hours(Cycle.H70_8D.value // HOUR)

    CLOCKS: Final = ("drive_left_h", "window_left_h", "until_break_h", "cycle_left_h")

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        # With the toggle off the form may still send its last clock values;
        # they're ignored, so they aren't validated either.
        if (
            isinstance(data, dict)
            and data.get("enabled", False) in serializers.BooleanField.FALSE_VALUES
        ):
            return {"enabled": False}
        validated: dict[str, Any] = super().to_internal_value(data)
        return validated

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not attrs.get("enabled"):
            return {"enabled": False}
        missing = {
            f: ["Required when Hours of Service is on."]
            for f in ("cycle", *self.CLOCKS)
            if f not in attrs
        }
        if missing:
            raise serializers.ValidationError(missing)
        cycle_limit = CYCLES[attrs["cycle"]].value / HOUR
        if attrs["cycle_left_h"] > cycle_limit:
            raise serializers.ValidationError(
                {"cycle_left_h": [f"Ensure this value is less than or equal to {cycle_limit:g}."]}
            )
        if attrs["drive_left_h"] > min(attrs["window_left_h"], attrs["cycle_left_h"]):
            raise serializers.ValidationError(
                {"drive_left_h": ["Can't be more than the shift window or cycle time left."]}
            )
        return attrs


class PlanRequestSerializer(serializers.Serializer[PlanRequest]):
    class Meta:
        ref_name = "Plan"

    origin = PlaceInSerializer()
    destination = PlaceInSerializer()
    departure = AwareDateTimeField()
    load_lb = serializers.IntegerField(min_value=1, max_value=MAX_LOAD_LB)
    interval_mi = serializers.ChoiceField(choices=list(ALLOWED_INTERVALS_MI))
    hos = HosInSerializer(required=False)

    def validate_departure(self, value: datetime) -> datetime:
        now = self.context.get("now") or timezone.now()
        if value < now - DEPARTURE_PAST:
            raise serializers.ValidationError("Departure can't be in the past.")
        if value > now + DEPARTURE_FUTURE:
            raise serializers.ValidationError("Departure must be within the next 7 days.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        o, d = attrs["origin"], attrs["destination"]
        if haversine_mi(LatLon(o["lat"], o["lon"]), LatLon(d["lat"], d["lon"])) <= MIN_TRIP_MI:
            raise serializers.ValidationError(
                {"destination": ["Destination must be more than a mile from the origin."]}
            )
        return attrs

    def to_request(self) -> PlanRequest:
        data = self.validated_data
        hos = data.get("hos") or {"enabled": False}
        clocks = None
        if hos["enabled"]:
            clocks = HosClocks(
                CYCLES[hos["cycle"]],
                *(round(hos[f] * HOUR) for f in HosInSerializer.CLOCKS),
            )
        return PlanRequest(
            origin=_place(data["origin"]),
            destination=_place(data["destination"]),
            departure=data["departure"],
            load_lb=data["load_lb"],
            interval_mi=data["interval_mi"],
            hos=clocks,
        )


def _place(data: dict[str, Any]) -> Place:
    return Place(data["label"], LatLon(data["lat"], data["lon"]), data["tz"])


# --- Output ------------------------------------------------------------------

WARNING_CODES: Final = list(get_args(WarningCode))
STOP_REASONS: Final = list(get_args(StopReason))


class UtcDateTimeField(serializers.DateTimeField):
    """UTC, whole seconds: 2026-10-12T11:23:26Z."""

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(format="%Y-%m-%dT%H:%M:%SZ", default_timezone=UTC, **kwargs)


class Rounded(serializers.FloatField):
    def __init__(self, digits: int, **kwargs: Any) -> None:
        self.digits = digits
        super().__init__(**kwargs)

    # The stubs type FloatField's output as str; DRF returns a float.
    def to_representation(self, value: float) -> float:  # type: ignore[override]
        return round(float(value), self.digits)


class Seconds(serializers.IntegerField):
    def to_representation(self, value: float) -> int:
        return round(value)


def _choices(literal: Any) -> list[str]:
    """The values of a Literal type, as a list of choices."""
    return list(get_args(literal))


def _output_choice(literal: Any, **kwargs: Any) -> serializers.ChoiceField:
    """A string from a fixed set, typed as an enum in the schema."""
    return serializers.ChoiceField(choices=_choices(literal), **kwargs)


@extend_schema_field({"type": "string", "enum": [level.name for level in Level]})
class LevelField(serializers.CharField):
    """A risk level by name: "LOW", "MODERATE", "HIGH", "SEVERE" or "NO_TRAVEL"; null is Unknown."""

    def to_representation(self, value: Any) -> str:
        return str(value.name)


@extend_schema_field({"type": "string", "enum": [kind.value for kind in StopKind]})
class StopKindField(serializers.CharField):
    def to_representation(self, value: Any) -> str:
        return str(value.value)


class PlaceOutSerializer(serializers.Serializer[Place]):
    class Meta:
        ref_name = "Place"

    label = serializers.CharField()  # type: ignore[assignment]  # Field.label
    lat = Rounded(5, source="position.lat")
    lon = Rounded(5, source="position.lon")
    tz = serializers.CharField(allow_null=True)


class HosOutSerializer(serializers.Serializer[HosClocks]):
    class Meta:
        ref_name = "Hos"

    enabled = serializers.SerializerMethodField()
    cycle = serializers.SerializerMethodField()
    drive_left_h = serializers.SerializerMethodField()
    window_left_h = serializers.SerializerMethodField()
    until_break_h = serializers.SerializerMethodField()
    cycle_left_h = serializers.SerializerMethodField()

    def get_enabled(self, clocks: HosClocks) -> bool:
        return True

    @extend_schema_field(serializers.ChoiceField(choices=list(CYCLES)))
    def get_cycle(self, clocks: HosClocks) -> str:
        return next(k for k, v in CYCLES.items() if v is clocks.cycle)

    def get_drive_left_h(self, clocks: HosClocks) -> float:
        return round(clocks.drive_left_s / HOUR, 2)

    def get_window_left_h(self, clocks: HosClocks) -> float:
        return round(clocks.window_left_s / HOUR, 2)

    def get_until_break_h(self, clocks: HosClocks) -> float:
        return round(clocks.until_break_s / HOUR, 2)

    def get_cycle_left_h(self, clocks: HosClocks) -> float:
        return round(clocks.cycle_left_s / HOUR, 2)


class InputsSerializer(serializers.Serializer[PlanRequest]):
    origin = PlaceOutSerializer()
    destination = PlaceOutSerializer()
    departure = UtcDateTimeField()
    load_lb = serializers.IntegerField()
    interval_mi = serializers.IntegerField()
    hos = HosOutSerializer(allow_null=True)


class ForecastSerializer(serializers.Serializer[Any]):
    valid_hour = UtcDateTimeField()
    wind_mph = serializers.FloatField(allow_null=True)
    gust_mph = serializers.FloatField(allow_null=True)
    rain_in_hr = serializers.FloatField(allow_null=True)
    snow_in_hr = serializers.FloatField(allow_null=True)
    weather_code = serializers.IntegerField(allow_null=True)


class RiskSerializer(serializers.Serializer[Any]):
    level = LevelField(allow_null=True)
    driver = _output_choice(Condition, allow_null=True)
    wind = LevelField(allow_null=True)
    wind_adjusted = LevelField(allow_null=True)
    rain = LevelField(allow_null=True)
    snow = LevelField(allow_null=True)
    load_rule = _output_choice(LoadRule, allow_null=True)


class CheckpointSerializer(serializers.Serializer[Any]):
    mile = Rounded(2)
    owned_mi = Rounded(2)
    lat = Rounded(5, source="position.lat")
    lon = Rounded(5, source="position.lon")
    eta = UtcDateTimeField()
    forecast = ForecastSerializer(allow_null=True)
    risk = RiskSerializer()


class HosStopSerializer(serializers.Serializer[PlacedStop]):
    kind = StopKindField(source="stop.kind")
    reason = _output_choice(StopReason, source="stop.reason")
    mile = Rounded(2)
    lat = Rounded(5, source="position.lat")
    lon = Rounded(5, source="position.lon")
    start = UtcDateTimeField()
    duration_s = serializers.IntegerField(source="stop.duration_s")


class MilesByLevelSerializer(serializers.Serializer[dict[str, float]]):
    LOW = Rounded(2)
    MODERATE = Rounded(2)
    HIGH = Rounded(2)
    SEVERE = Rounded(2)
    NO_TRAVEL = Rounded(2)
    UNKNOWN = Rounded(2)


class MetricsSerializer(serializers.Serializer[Any]):
    miles_by_level = MilesByLevelSerializer()
    avg_risk = Rounded(3, allow_null=True)
    worst = LevelField(allow_null=True)
    worst_at_mile = Rounded(2, allow_null=True)
    drivable = serializers.BooleanField()


class RouteSerializer(serializers.Serializer[Any]):
    id = serializers.CharField()
    rank = serializers.IntegerField()
    name = serializers.CharField()
    label = serializers.CharField(source="route.label", allow_null=True)  # type: ignore[assignment]
    geometry = serializers.SerializerMethodField(help_text="Encoded polyline, precision 5.")
    distance_mi = Rounded(2, source="route.distance_mi")
    duration_s = Seconds(source="route.duration_s", help_text="Driving time only.")
    trip_duration_s = Seconds(help_text="Driving plus Hours of Service stops.")
    departure = UtcDateTimeField()
    arrival = UtcDateTimeField()
    eta_estimated = serializers.BooleanField()
    hos_stops = HosStopSerializer(many=True)
    metrics = MetricsSerializer()
    checkpoints = CheckpointSerializer(many=True)

    def get_geometry(self, route: Any) -> str:
        return encode(route.route.geometry)


class WarningSerializer(serializers.Serializer[Any]):
    code = _output_choice(WarningCode)
    message = serializers.CharField()
    route_id = serializers.CharField(allow_null=True)


class SettingsSerializer(serializers.Serializer[Plan]):
    wind_basis = serializers.SerializerMethodField()
    avg_risk_tolerance = serializers.SerializerMethodField()
    hos_enabled = serializers.SerializerMethodField()

    def get_wind_basis(self, plan: Plan) -> str:
        return "gust"

    def get_avg_risk_tolerance(self, plan: Plan) -> float:
        return RISK_AVG_TOLERANCE

    def get_hos_enabled(self, plan: Plan) -> bool:
        return plan.request.hos is not None


class CorridorSerializer(serializers.Serializer[Plan]):
    bbox = serializers.SerializerMethodField(help_text="[west, south, east, north] of all routes.")

    def get_bbox(self, plan: Plan) -> list[float]:
        points = [p for r in plan.routes for p in r.route.geometry]
        return [
            round(min(p.lon for p in points), 5),
            round(min(p.lat for p in points), 5),
            round(max(p.lon for p in points), 5),
            round(max(p.lat for p in points), 5),
        ]


class PlanSerializer(serializers.Serializer[Plan]):
    generated_at = UtcDateTimeField()
    rules_version = serializers.CharField()
    stale = serializers.BooleanField()
    forecast_as_of = UtcDateTimeField(allow_null=True)
    demo = serializers.BooleanField()
    inputs = InputsSerializer(source="request")
    settings = SettingsSerializer(source="*")
    recommended_route_id = serializers.CharField(source="recommended_id", allow_null=True)
    reason_code = _output_choice(ReasonCode)
    recommendation_reason = serializers.CharField(source="reason")
    warnings = WarningSerializer(many=True)
    routes = RouteSerializer(many=True)
    corridor = CorridorSerializer(source="*")


# --- Heatmap -----------------------------------------------------------------


class HeatmapSerializer(serializers.Serializer[HeatmapGrid]):
    """The corridor grid (RFC §7.3).

    `risk[i][h]` is point i's level (0-4) at hour h; null is Unknown.
    """

    start_hour = UtcDateTimeField(help_text="The forecast hour shown at slider hour 0.")
    hours = serializers.IntegerField()
    cell_deg = serializers.FloatField()
    stale = serializers.BooleanField()
    forecast_as_of = UtcDateTimeField(allow_null=True)
    points = serializers.SerializerMethodField(help_text="[lon, lat] per grid point.")
    risk = serializers.SerializerMethodField()

    def get_points(self, grid: HeatmapGrid) -> list[list[float]]:
        return [[round(p.lon, 4), round(p.lat, 4)] for p in grid.points]

    def get_risk(self, grid: HeatmapGrid) -> list[list[int | None]]:
        return [[None if level is None else int(level) for level in row] for row in grid.risk]


# --- Geocoding ---------------------------------------------------------------

MAX_QUERY: Final = 100


class SuggestQuerySerializer(serializers.Serializer[dict[str, str]]):
    q = serializers.CharField(max_length=MAX_QUERY, allow_blank=True, trim_whitespace=True)


# --- Errors ------------------------------------------------------------------


class ErrorDetailSerializer(serializers.Serializer[dict[str, Any]]):
    code = serializers.CharField(help_text="Stable machine-readable code, e.g. invalid_input.")
    message = serializers.CharField(help_text="A sentence for the user.")
    fields = serializers.DictField(  # type: ignore[assignment]  # Serializer.fields
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
        help_text='Validation messages by field, nested fields dotted: {"hos.drive_left_h": [...]}',
    )


class ErrorSerializer(serializers.Serializer[dict[str, Any]]):
    error = ErrorDetailSerializer()
