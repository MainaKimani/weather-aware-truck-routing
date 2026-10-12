"""Delete trips past retention, then expired sessions (RFC §3.1).

Run daily by the host's scheduler. Guest trips go after 30 days and users'
unsaved trips after 90; saved trips stay until their owner deletes them.
Routes and heatmaps go with their trips.
"""

import logging
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.utils import timezone

from planner.repositories import expired_trips

logger = logging.getLogger("planner.purge")


class Command(BaseCommand):
    help = "Delete guest trips over 30 days old and unsaved user trips over 90, then sessions."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--dry-run", action="store_true", help="Count what would go; delete nothing."
        )

    def handle(self, *args: Any, dry_run: bool = False, **options: Any) -> None:
        guests, unsaved = expired_trips(timezone.now())
        if dry_run:
            counts = {"guest_trips": guests.count(), "unsaved_trips": unsaved.count()}
        else:
            with transaction.atomic():
                counts = {
                    "guest_trips": guests.delete()[1].get("planner.Trip", 0),
                    "unsaved_trips": unsaved.delete()[1].get("planner.Trip", 0),
                }
            call_command("clearsessions")
        logger.info(
            "%s %d guest and %d unsaved trips",
            "would purge" if dry_run else "purged",
            counts["guest_trips"],
            counts["unsaved_trips"],
            extra={"event": "purge", "dry_run": dry_run, **counts},
        )
        verb = "Would delete" if dry_run else "Deleted"
        self.stdout.write(
            f"{verb} {counts['guest_trips']} guest trips and {counts['unsaved_trips']} "
            "unsaved user trips."
        )
