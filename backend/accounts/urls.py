from django.urls import path

from accounts import api

urlpatterns = [
    path("me", api.MeView.as_view(), name="me"),
]
