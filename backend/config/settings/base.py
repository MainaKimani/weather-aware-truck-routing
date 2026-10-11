"""Settings shared by every environment.

All configuration comes from the environment (12-factor). `local` and `prod`
import this module and override only what differs; nothing here may assume
which one is running.
"""

from pathlib import Path
from typing import Any

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()

DEBUG = False
SECRET_KEY = env.str("DJANGO_SECRET_KEY", default="")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "planner",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Postgres and the custom user model arrive together in SPOT-14. Until then
# nothing is migrated, so no database is opened.
DATABASES = {
    "default": env.db("DATABASE_URL", default="sqlite:///:memory:"),
}

REDIS_URL = env.str("REDIS_URL", default="")


def cache_config(redis_url: str) -> dict[str, dict[str, Any]]:
    """Redis when configured; otherwise a per-process cache for local dev and tests."""
    if redis_url:
        return {
            "default": {
                "BACKEND": "django_redis.cache.RedisCache",
                "LOCATION": redis_url,
                "OPTIONS": {
                    # A cache outage degrades to cache misses, not 500s (RFC §9).
                    "IGNORE_EXCEPTIONS": True,
                    "SOCKET_CONNECT_TIMEOUT": 2,
                    "SOCKET_TIMEOUT": 2,
                },
            }
        }
    return {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


CACHES = cache_config(REDIS_URL)

# Provider credentials. Open-Meteo needs no key.
HERE_API_KEY = env.str("HERE_API_KEY", default="")

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
}
