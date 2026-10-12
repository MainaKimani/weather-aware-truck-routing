from django.urls import path
from drf_spectacular.views import SpectacularAPIView

from planner.api import views

urlpatterns = [
    path("plans", views.PlanView.as_view(), name="plans"),
    # A string, not <uuid:>, so a malformed id gets the API's JSON 404 from the
    # access check rather than Django's HTML one.
    path("trips/<str:trip_id>/heatmap", views.TripHeatmapView.as_view(), name="trip-heatmap"),
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("geocode/suggest", views.GeocodeSuggestView.as_view(), name="geocode-suggest"),
]
