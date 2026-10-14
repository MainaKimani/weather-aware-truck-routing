# Production image for the API (Render builds it from backend/). Local
# development uses docker-compose.yml at the repo root instead.

# Build: install the locked dependencies, without the dev group, into /venv,
# and collect the admin's static files.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/venv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
# With the production settings, whose static storage writes the hashed-name
# manifest it later reads; collectstatic connects to nothing, so placeholders
# satisfy the required settings.
RUN DJANGO_SETTINGS_MODULE=config.settings.prod \
    DJANGO_SECRET_KEY=collectstatic DJANGO_ALLOWED_HOSTS=build CSRF_TRUSTED_ORIGINS=https://build \
    DATABASE_URL=postgres://build/build REDIS_URL=redis://build HERE_API_KEY=build \
    /venv/bin/python manage.py collectstatic --noinput

# Run: the same Python, the venv and the app, as a non-root user.
FROM python:3.12-slim-bookworm
RUN useradd --create-home --uid 10001 app
COPY --from=build /venv /venv
COPY --from=build --chown=app:app /app /app
WORKDIR /app
USER app
ENV PATH=/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod
EXPOSE 10000
# Migrations run on every start: Render's free plan has no pre-deploy step,
# and a run with nothing to apply takes a moment. WEB_CONCURRENCY workers of
# 4 threads each; 2 fits the free instance's 512 MB.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi --bind 0.0.0.0:${PORT:-10000} --workers ${WEB_CONCURRENCY:-2} --threads 4 --timeout 60 --graceful-timeout 20"]
