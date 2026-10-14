import threading
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import httpx
import pytest
import respx
from django.db import connection
from django.test import override_settings

from planner.models import ProviderUsage
from planner.providers.base import QuotaReached
from planner.providers.budget import MonthlyBudget, cap_for
from planner.providers.here_geocoder import AUTOSUGGEST_URL
from planner.providers.registry import get_providers


class Clock:
    def __init__(self, t: datetime) -> None:
        self.t = t

    def __call__(self) -> datetime:
        return self.t


def test_the_cap_is_90_percent_of_the_allowance_rounded_down() -> None:
    assert cap_for(4000) == 3600
    assert cap_for(10) == 9
    assert cap_for(5) == 4


@pytest.mark.django_db
class TestMonthlyBudget:
    def test_counts_each_call_and_refuses_at_the_cap(self) -> None:
        budget = MonthlyBudget("here_routing", "routing", monthly_allowance=4)  # cap 3
        for _ in range(3):
            budget.spend()

        with pytest.raises(QuotaReached) as raised:
            budget.spend()

        assert raised.value.service == "routing"
        assert raised.value.code == "quota_reached"
        assert budget.used() == 3

    def test_services_have_separate_budgets(self) -> None:
        routing = MonthlyBudget("here_routing", "routing", monthly_allowance=2)  # cap 1
        autosuggest = MonthlyBudget("here_autosuggest", "place search", monthly_allowance=2)
        routing.spend()

        autosuggest.spend()

        with pytest.raises(QuotaReached):
            routing.spend()

    def test_a_new_month_starts_from_zero(self) -> None:
        clock = Clock(datetime(2026, 10, 31, 23, 59, tzinfo=UTC))
        budget = MonthlyBudget("here_routing", "routing", monthly_allowance=2, clock=clock)
        budget.spend()
        with pytest.raises(QuotaReached):
            budget.spend()

        clock.t = datetime(2026, 11, 1, 0, 0, tzinfo=UTC)
        budget.spend()

        months = ProviderUsage.objects.order_by("month").values_list("month", "count")
        assert [(m.isoformat(), c) for m, c in months] == [("2026-10-01", 1), ("2026-11-01", 1)]

    def test_months_follow_utc_not_local_time(self) -> None:
        # 20:00 on 31 October in Denver is already November in UTC.
        late = datetime(2026, 10, 31, 20, 0, tzinfo=ZoneInfo("America/Denver"))
        MonthlyBudget("here_routing", "routing", 4000, clock=lambda: late).spend()

        assert ProviderUsage.objects.get().month.isoformat() == "2026-11-01"


@pytest.mark.django_db(transaction=True)
def test_concurrent_workers_never_spend_past_the_cap() -> None:
    budget = MonthlyBudget("here_routing", "routing", monthly_allowance=6)  # cap 5
    start = threading.Barrier(20)
    refused: list[QuotaReached] = []

    def worker() -> None:
        try:
            start.wait()
            budget.spend()
        except QuotaReached as exc:
            refused.append(exc)
        finally:
            connection.close()

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert budget.used() == 5
    assert len(refused) == 15


@pytest.mark.django_db
@respx.mock
def test_real_providers_charge_their_own_service() -> None:
    respx.get(AUTOSUGGEST_URL).mock(return_value=httpx.Response(200, json={"items": []}))
    with override_settings(PROVIDERS="real", HERE_API_KEY="k"):
        providers = get_providers()

    providers.geocoder.suggest("dallas")

    usage = dict(ProviderUsage.objects.values_list("service", "count"))
    assert usage == {"here_autosuggest": 1}


@pytest.mark.django_db
@respx.mock
def test_real_providers_stop_calling_here_once_the_budget_is_spent() -> None:
    route = respx.get(AUTOSUGGEST_URL).mock(return_value=httpx.Response(200, json={"items": []}))
    settings = {"PROVIDERS": "real", "HERE_API_KEY": "k", "HERE_AUTOSUGGEST_MONTHLY_ALLOWANCE": 2}
    with override_settings(**settings):
        providers = get_providers()
    providers.geocoder.suggest("dallas")

    with pytest.raises(QuotaReached):
        providers.geocoder.suggest("denver")

    assert route.call_count == 1
