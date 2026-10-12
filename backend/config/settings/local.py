"""Local development and tests. Reads backend/.env if present; works without one."""

from pathlib import Path

import environ

# Read .env before importing base, so its values reach every setting there.
# Real environment variables still win. Production never reads a .env file.
environ.Env.read_env(Path(__file__).resolve().parents[2] / ".env")

from config.settings.base import *  # noqa: E402, F403
from config.settings.base import LOGGING, REST_FRAMEWORK, env  # noqa: E402

DEBUG = env.bool("DJANGO_DEBUG", default=True)
SECRET_KEY = env.str("DJANGO_SECRET_KEY", default="dev-only-insecure-key")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
# The frontend's dev server (5173) and preview (4173) proxy /api here. Django
# checks an unsafe request's Origin as well as its CSRF token, so signing in
# works only from an origin listed here; production lists the site's own.
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=[
        f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 4173)
    ],
)

LOGGING["handlers"]["console"]["formatter"] = env.str("LOG_FORMAT", default="plain")

# End-to-end runs plan dozens of trips a minute from one address, which the
# guest limits would refuse; they set this to lift every API limit. allauth's
# login-failure limits stay. Local settings only: production can't turn it on.
if env.bool("THROTTLE_GENEROUS", default=False):
    REST_FRAMEWORK = {
        **REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": dict.fromkeys(
            REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "10000/min"
        ),
    }
