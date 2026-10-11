from django.urls import path

from planner.api import views

urlpatterns = [
    path("healthz", views.healthz, name="healthz"),
]
