from django.urls import path
from drf_spectacular.views import SpectacularAPIView

from config import health
from planner.api import views

urlpatterns = [
    # Kept for the frontend's placeholder page; hosts check /healthz.
    path("healthz", health.healthz, name="api-healthz"),
    path("plans", views.PlanView.as_view(), name="plans"),
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("geocode/suggest", views.GeocodeSuggestView.as_view(), name="geocode-suggest"),
]
