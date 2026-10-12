"""The committed OpenAPI schema must match the code.

The frontend's types are generated from backend/openapi.yaml, so a response
change that isn't regenerated would reach the browser untyped. Regenerate
with `make schema` and commit the result.
"""

from io import StringIO
from pathlib import Path

import yaml
from django.core.management import call_command
from django.test import Client

COMMITTED = Path(__file__).resolve().parents[2] / "openapi.yaml"


def generate() -> str:
    out = StringIO()
    call_command("spectacular", "--validate", "--fail-on-warn", stdout=out)
    return out.getvalue()


def test_committed_schema_is_up_to_date() -> None:
    assert COMMITTED.read_text() == generate(), (
        "backend/openapi.yaml is out of date: run `make schema` and commit it"
    )


def test_schema_is_served() -> None:
    response = Client().get("/api/v1/schema")

    assert response.status_code == 200
    schema = yaml.safe_load(response.content)
    assert set(schema["paths"]) == {
        "/api/v1/plans",
        "/api/v1/geocode/suggest",
        "/api/v1/trips",
        "/api/v1/trips/{trip_id}",
        "/api/v1/trips/{trip_id}/heatmap",
    }


def test_contract_names_the_shapes_the_frontend_uses() -> None:
    components = yaml.safe_load(COMMITTED.read_text())["components"]["schemas"]

    assert {
        "PlanRequest",
        "Plan",
        "Route",
        "Checkpoint",
        "Place",
        "Heatmap",
        "Trip",
        "TripSummary",
        "Error",
    } <= set(components)
    assert components["RiskLevelEnum"]["enum"] == ["LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL"]
