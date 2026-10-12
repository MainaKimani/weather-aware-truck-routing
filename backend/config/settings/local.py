"""Local development and tests. Reads backend/.env if present; works without one."""

from pathlib import Path

import environ

# Read .env before importing base, so its values reach every setting there.
# Real environment variables still win. Production never reads a .env file.
environ.Env.read_env(Path(__file__).resolve().parents[2] / ".env")

from config.settings.base import *  # noqa: E402, F403
from config.settings.base import LOGGING, env  # noqa: E402

DEBUG = env.bool("DJANGO_DEBUG", default=True)
SECRET_KEY = env.str("DJANGO_SECRET_KEY", default="dev-only-insecure-key")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

LOGGING["handlers"]["console"]["formatter"] = env.str("LOG_FORMAT", default="plain")
