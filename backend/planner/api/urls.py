from django.urls import path

from planner.api import views

urlpatterns = [
    path("healthz", views.healthz, name="healthz"),
    path("plans", views.PlanView.as_view(), name="plans"),
]
