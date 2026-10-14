"""Production. Refuses to start unless every required setting is present.

HTTPS only: the host terminates TLS and forwards X-Forwarded-Proto, plain
HTTP is redirected (except the health checks, which the host calls inside
its network), cookies are Secure, and HSTS tells browsers to stay on HTTPS.
`manage.py check --deploy` passes with these settings (tested).
"""

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403
from config.settings.base import ALLOWED_HOSTS, MIDDLEWARE, env

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

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r"^healthz$", r"^readyz$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31_536_000)  # a year

# HSTS for subdomains and the preload list are for a domain we own outright.
# The app is served from a host's shared domain (or a subdomain of someone's),
# where those would be presumptuous, so the two deploy-check warnings that
# ask for them are silenced deliberately.
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]

# Render sets the service's own hostname; it's always allowed, for direct
# requests such as the admin's.
_render_host = env.str("RENDER_EXTERNAL_HOSTNAME", default="")
if _render_host and _render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, _render_host]

# WhiteNoise serves the collected static files (the admin's) from the app,
# right after SecurityMiddleware as its docs ask. Local runs use Django's own
# static serving and have no collected files, so it's added here only.
MIDDLEWARE = [
    *MIDDLEWARE[: MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1],
    "whitenoise.middleware.WhiteNoiseMiddleware",
    *MIDDLEWARE[MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1 :],
]

# Collected and compressed at image build time, with hashed names that can be
# cached for good.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# No mail service yet: allauth's only email (password reset, which the SPA
# doesn't offer) goes to the logs instead of failing on a missing SMTP server.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
