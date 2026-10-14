"""Settings shared by every environment.

All configuration comes from the environment (12-factor). `local` and `prod`
import this module and override only what differs; nothing here may assume
which one is running.
"""

from pathlib import Path
from typing import Any

import django_stubs_ext
import environ

# Lets Django's generic classes be subscripted at runtime (UserAdmin[User]).
django_stubs_ext.monkeypatch()

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
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.headless",
    "accounts",
    "planner",
]

MIDDLEWARE = [
    # First, so every later log line (including errors) carries the request id.
    "config.observability.RequestIdMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
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

# Postgres everywhere, including local dev and tests, so constraints and JSON
# behave as in production (RFC §15). The default is the local socket.
DATABASES = {
    "default": {
        **env.db("DATABASE_URL", default="postgres:///spotter"),
        # Persistent connections, checked before reuse (RFC §18).
        "CONN_MAX_AGE": env.int("DB_CONN_MAX_AGE", default=60),
        "CONN_HEALTH_CHECKS": True,
    },
}

AUTH_USER_MODEL = "accounts.User"

# Accounts (RFC §3.2, §7.5): django-allauth's headless API for the browser,
# under /api/auth/. Email and password only, no usernames; verification is
# off for the assessment (PRD §7.9). Failed logins are rate limited by
# allauth's defaults (per IP and per email), counted in the cache.
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
ACCOUNT_ADAPTER = "accounts.adapter.AccountAdapter"
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_UNIQUE_EMAIL = True
# Signed-in sessions last as long as guest ones (SESSION_COOKIE_AGE), not
# until the browser closes.
ACCOUNT_SESSION_REMEMBER = True
HEADLESS_ONLY = True
HEADLESS_CLIENTS = ("browser",)
# Where allauth's emails would link to; only password reset sends one, and
# the SPA has no page for it yet, so it points at the planner.
HEADLESS_FRONTEND_URLS = {
    "account_reset_password_from_key": "/?reset={key}",
    "account_signup": "/signup",
}

# Argon2 for new and changed passwords (RFC §12); the rest still verify
# hashes made before it.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

# Cookies (RFC §3.2, §12). The browser sees one origin (the frontend proxies
# /api), so Lax is enough and no CORS is configured. The CSRF cookie is
# readable by JavaScript on purpose: the client copies it into X-CSRFToken,
# and Django's docs note an httpOnly CSRF cookie adds no protection.
# Sessions are read on every request: the cache serves them, Postgres keeps
# them. A guest's session holds the id their trips are filed under, so it
# lasts as long as guest trips are kept (30 days, RFC §3.2).
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"
SESSION_COOKIE_AGE = 30 * 24 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_FAILURE_VIEW = "config.csrf.csrf_failure"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

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
    return {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            # The default of 300 entries is less than one corridor heatmap
            # (up to ~700 forecast entries), which would never stay cached.
            "OPTIONS": {"MAX_ENTRIES": 10_000},
        }
    }


CACHES = cache_config(REDIS_URL)

# Provider credentials. Open-Meteo needs no key.
HERE_API_KEY = env.str("HERE_API_KEY", default="")
# HERE's free monthly transactions for each service. The app stops calling a
# service at 90% of its allowance (planner/providers/budget.py), so going
# over never reaches the card on file.
HERE_ROUTING_MONTHLY_ALLOWANCE = env.int("HERE_ROUTING_MONTHLY_ALLOWANCE", default=4000)
HERE_AUTOSUGGEST_MONTHLY_ALLOWANCE = env.int("HERE_AUTOSUGGEST_MONTHLY_ALLOWANCE", default=4000)

# "fake" runs on deterministic providers with no network or keys (tests,
# local dev, demo mode); "real" uses HERE and Open-Meteo. FAKE_SCENARIO picks
# the demo storm: "demo" or "strong".
PROVIDERS = env.str("PROVIDERS", default="fake")
FAKE_SCENARIO = env.str("FAKE_SCENARIO", default="demo")

# The reviewer's demo account (manage.py seed_demo); its password is never in the code.
DEMO_EMAIL = env.str("DEMO_EMAIL", default="demo@example.com")
DEMO_PASSWORD = env.str("DEMO_PASSWORD", default="")

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
    "EXCEPTION_HANDLER": "planner.api.errors.exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # RFC §12. Counters live in the default cache.
    "DEFAULT_THROTTLE_RATES": {
        "plans_guest": "10/min",
        "plans_user": "30/min",
        "geocode": "60/min",
        "heatmap": "20/min",
        # Reading trips: lists and pages, which the UI refetches as trips change.
        "trips": "120/min",
        # Deleting an account checks its password; per user.
        "delete_account": "5/min",
    },
    # How many proxies sit in front of Django and append to X-Forwarded-For.
    # 0 trusts only REMOTE_ADDR, so a client can't pick its own throttle key;
    # production sets it to match the host's proxy chain.
    "NUM_PROXIES": env.int("NUM_PROXIES", default=0),
}

# The OpenAPI schema is generated from the serializers and committed as
# backend/openapi.yaml; the frontend's types are generated from that file.
SPECTACULAR_SETTINGS = {
    "TITLE": "Weather-Aware Truck Routing API",
    "DESCRIPTION": "Plans truck routes rated for weather risk along the way.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Separate request and response components, so read-only and write-only
    # shapes don't merge into one type in the generated client.
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "ENUM_NAME_OVERRIDES": {
        "RiskLevelEnum": ["LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL"],
        "RiskDriverEnum": "planner.domain.risk.CONDITION_ORDER",
        "WarningCodeEnum": "planner.api.serializers.WARNING_CODES",
        "HosStopKindEnum": ["break", "rest", "restart"],
        "HosStopReasonEnum": "planner.api.serializers.STOP_REASONS",
    },
}

# One JSON object per line on stdout (RFC §14), each with the request id.
# LOG_FORMAT=plain gives readable lines for local development.
LOG_FORMAT = env.str("LOG_FORMAT", default="json")
LOGGING: dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "config.observability.RequestIdFilter"}},
    "formatters": {
        "json": {"()": "config.observability.JsonFormatter"},
        "plain": {"format": "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "filters": ["request_id"],
            "formatter": LOG_FORMAT,
        },
    },
    "root": {"handlers": ["console"], "level": env.str("LOG_LEVEL", default="INFO")},
    "loggers": {
        # Django's own console handler would print these a second time.
        "django": {"handlers": [], "level": "INFO", "propagate": True},
        # httpx logs every request URL at INFO, query string included, and
        # HERE's key travels in the query string. planner.providers logs each
        # call without the URL instead.
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
    },
}
