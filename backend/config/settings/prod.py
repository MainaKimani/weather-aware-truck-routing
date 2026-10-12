"""Production. Refuses to start unless every required setting is present.

Transport and cookie hardening (HSTS, secure cookies, proxy SSL header) is
not configured yet.
"""

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403
from config.settings.base import env

REQUIRED = (
    "DJANGO_SECRET_KEY",
    "DJANGO_ALLOWED_HOSTS",
    "CSRF_TRUSTED_ORIGINS",
    "DATABASE_URL",
    "REDIS_URL",
    "HERE_API_KEY",
)

_missing = [name for name in REQUIRED if not env.str(name, default="").strip()]
if _missing:
    raise ImproperlyConfigured("Missing required production settings: " + ", ".join(_missing))

DEBUG = False
PROVIDERS = env.str("PROVIDERS", default="real")
