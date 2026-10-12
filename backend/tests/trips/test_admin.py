import pytest
from django.test import Client

from tests.trips.factories import make_route, make_trip, make_user

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff(client: Client) -> Client:
    admin = make_user("admin@example.com")
    admin.is_staff = admin.is_superuser = True
    admin.save()
    client.force_login(admin)
    return client


def test_trip_list_shows_owner_and_filters(staff: Client) -> None:
    make_trip(user=make_user(), origin_label="Tulsa, OK")
    make_trip()

    page = staff.get("/admin/planner/trip/")
    assert page.status_code == 200
    assert b"driver@example.com" in page.content
    assert b"guest " in page.content

    guests = staff.get("/admin/planner/trip/?owner=guest")
    assert b"Tulsa" not in guests.content

    found = staff.get("/admin/planner/trip/?q=Tulsa")
    assert b"Tulsa" in found.content


def test_trip_page_shows_routes_read_only(staff: Client) -> None:
    trip = make_trip()
    make_route(trip, label="via Amarillo")

    page = staff.get(f"/admin/planner/trip/{trip.pk}/change/")

    assert page.status_code == 200
    assert b"via Amarillo" in page.content
    assert b'name="routes-0-rank"' not in page.content  # shown, not editable
