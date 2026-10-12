from django.contrib import admin
from django.urls import include, path

from config import health

urlpatterns = [
    path("healthz", health.healthz, name="healthz"),
    path("readyz", health.readyz, name="readyz"),
    path("admin/", admin.site.urls),
    # allauth's headless API: sign up, log in, session, log out (RFC §7.5).
    path("api/auth/", include("allauth.headless.urls")),
    path("api/v1/", include("planner.api.urls")),
    path("api/v1/", include("accounts.urls")),
]
