"""Who may see and change a trip (RFC §3.2). Every trip endpoint goes through here.

A trip belongs to a signed-in user or to a guest, identified by a random
`guest_id` kept in the guest's session. The owner sees their trips; anyone
sees a shared one. A trip the caller can't see is a 404, never a 403, so
trip ids can't be probed.
"""

import uuid
from dataclasses import dataclass
from typing import Any, Final

from django.core.exceptions import ValidationError
from django.db.models import Q, QuerySet
from django.http import Http404, HttpRequest
from rest_framework.request import Request

from planner.models import Trip

GUEST_KEY: Final = "guest_id"


@dataclass(frozen=True)
class Owner:
    """A signed-in user or a guest; exactly one of the two ids is set."""

    user_id: int | None = None
    guest_id: uuid.UUID | None = None

    def __post_init__(self) -> None:
        if (self.user_id is None) == (self.guest_id is None):
            raise ValueError("an owner is a user or a guest, not both or neither")

    @property
    def is_guest(self) -> bool:
        return self.guest_id is not None

    def trips(self) -> Q:
        """Matches the trips this owner owns."""
        if self.user_id is not None:
            return Q(user_id=self.user_id)
        return Q(guest_id=self.guest_id, user__isnull=True)

    def as_fields(self) -> dict[str, Any]:
        """The Trip fields that record this owner."""
        return {"user_id": self.user_id, "guest_id": self.guest_id}


def current_owner(request: HttpRequest | Request, *, create: bool = False) -> Owner | None:
    """The caller as an owner: the signed-in user, else the session's guest.

    With `create`, a caller with neither becomes a new guest (on their first
    plan); otherwise they are None, an anonymous visitor who owns nothing.
    """
    if request.user.is_authenticated:
        return Owner(user_id=request.user.pk)
    stored = request.session.get(GUEST_KEY)
    if stored:
        try:
            return Owner(guest_id=uuid.UUID(str(stored)))
        except ValueError:
            pass  # not ours; replaced below if asked to
    if not create:
        return None
    guest_id = uuid.uuid4()
    request.session[GUEST_KEY] = str(guest_id)
    return Owner(guest_id=guest_id)


def visible_trips(owner: Owner | None) -> QuerySet[Trip]:
    """Trips the caller may read: their own, and any shared one."""
    shared = Q(shared=True)
    return Trip.objects.filter(owner.trips() | shared if owner else shared)


def get_visible_trip(trip_id: uuid.UUID | str, owner: Owner | None) -> Trip:
    """The trip if the caller owns it or it is shared; Http404 otherwise."""
    return _get(visible_trips(owner), trip_id)


def get_owned_trip(trip_id: uuid.UUID | str, owner: Owner | None) -> Trip:
    """The trip only if the caller owns it, shared or not; for changes. Http404 otherwise."""
    if owner is None:
        raise Http404
    return _get(Trip.objects.filter(owner.trips()), trip_id)


def _get(trips: QuerySet[Trip], trip_id: uuid.UUID | str) -> Trip:
    try:
        return trips.get(pk=trip_id)
    except (Trip.DoesNotExist, ValidationError, ValueError, TypeError) as exc:
        # A malformed id is as unknown as a missing one.
        raise Http404 from exc
