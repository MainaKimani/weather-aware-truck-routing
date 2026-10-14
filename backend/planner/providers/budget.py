"""Monthly call budget for a metered provider service.

HERE's free tier allows a set number of transactions a month for each
service (routing and autosuggest are counted separately), and anything over
it is billed to the card on file. Each service gets a budget of 90% of its
allowance. Once that's spent, the service isn't called again until the next
calendar month (UTC), and callers get `QuotaReached`. The 10% kept back
absorbs what we can't count exactly: calls HERE bills that we don't see,
like requests from someone testing the key by hand.

The count is a Postgres row per service per month (`ProviderUsage`). Taking
a call is one conditional UPDATE (`count < cap`), so two workers can never
both take the last one. Every attempt counts, retries included, because
HERE bills each request it receives.
"""

import logging
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Final

from django.db.models import F

from planner.models import ProviderUsage
from planner.providers.base import QuotaReached

STOP_AT_SHARE: Final = 0.9

logger = logging.getLogger("planner.providers")


def cap_for(monthly_allowance: int) -> int:
    """How many calls the budget allows: 90% of the allowance, rounded down."""
    return int(monthly_allowance * STOP_AT_SHARE)


class MonthlyBudget:
    def __init__(
        self,
        service: str,
        label: str,
        monthly_allowance: int,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        """`service` keys the counter ("here_routing"); `label` names it for users ("routing")."""
        self.service = service
        self.label = label
        self.cap = cap_for(monthly_allowance)
        self._clock = clock

    def _month(self) -> date:
        return self._clock().astimezone(UTC).date().replace(day=1)

    def spend(self) -> None:
        """Take one call from this month's budget, or raise QuotaReached if none are left."""
        month = self._month()
        ProviderUsage.objects.get_or_create(service=self.service, month=month)
        taken = ProviderUsage.objects.filter(
            service=self.service, month=month, count__lt=self.cap
        ).update(count=F("count") + 1, updated_at=self._clock())
        if not taken:
            logger.warning(
                "%s monthly budget spent",
                self.service,
                extra={"provider": self.service, "outcome": "over_budget", "cap": self.cap},
            )
            raise QuotaReached(
                f"{self.service}: this month's budget of {self.cap} calls is spent", self.label
            )

    def used(self) -> int:
        row = ProviderUsage.objects.filter(service=self.service, month=self._month()).first()
        return row.count if row else 0
