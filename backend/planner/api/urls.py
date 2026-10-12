from django.urls import path
from drf_spectacular.views import SpectacularAPIView

from planner.api import views

urlpatterns = [
    path("healthz", views.healthz, name="healthz"),
    path("plans", views.PlanView.as_view(), name="plans"),
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("geocode/suggest", views.GeocodeSuggestView.as_view(), name="geocode-suggest"),
]
