from django.contrib import admin
from django.urls import include, path

from config import health

urlpatterns = [
    path("healthz", health.healthz, name="healthz"),
    path("readyz", health.readyz, name="readyz"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("planner.api.urls")),
]
