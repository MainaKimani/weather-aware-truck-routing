"""Signal handlers, connected in PlannerConfig.ready."""

from typing import Any

from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django.http import HttpRequest

from planner.access import claim_guest_trips


@receiver(user_logged_in)
def keep_guest_trips(
    sender: Any, request: HttpRequest | None, user: AbstractBaseUser, **_: Any
) -> None:
    """A guest who signs up or logs in keeps the trips planned on this device."""
    if request is not None:
        claim_guest_trips(request, user)
