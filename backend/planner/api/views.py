from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from planner.api.serializers import (
    PlanRequestSerializer,
    PlanSerializer,
    SuggestionSerializer,
    SuggestQuerySerializer,
)
from planner.providers.registry import get_providers
from planner.services.geocoding import suggest
from planner.services.plan import plan_trip


@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request: Request) -> Response:
    """Liveness: the process is up."""
    return Response({"status": "ok"})


class PlanView(APIView):
    """Plan a trip: three routes rated for weather risk, and a recommendation."""

    permission_classes = (AllowAny,)

    def post(self, request: Request) -> Response:
        serializer = PlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = plan_trip(serializer.to_request(), get_providers())
        return Response(PlanSerializer(plan).data)


class GeocodeSuggestView(APIView):
    """Places matching a partial query, for the origin and destination fields."""

    permission_classes = (AllowAny,)

    def get(self, request: Request) -> Response:
        query = SuggestQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        places = suggest(get_providers().geocoder, query.validated_data["q"])
        return Response([SuggestionSerializer(p).data for p in places])
