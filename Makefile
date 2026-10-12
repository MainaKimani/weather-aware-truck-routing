# Local development. `make dev` runs both apps natively; `make up` uses Docker.

.PHONY: install hooks migrate dev api web up down test lint fmt types schema

install:
	cd backend && uv sync
	cd frontend && npm ci
	$(MAKE) --no-print-directory hooks

hooks:
	uv run --project backend pre-commit install

migrate:
	cd backend && uv run python manage.py migrate

dev: migrate
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) --no-print-directory api & \
	$(MAKE) --no-print-directory web & \
	wait

api:
	cd backend && uv run python manage.py runserver 8000

web:
	cd frontend && npm run dev

up:
	docker compose up --build

down:
	docker compose down

test:
	cd backend && uv run pytest --cov
	cd frontend && npm test

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint && npm run format:check

fmt:
	cd backend && uv run ruff check --fix . && uv run ruff format .
	cd frontend && npx eslint . --fix && npm run format

types:
	cd backend && uv run mypy .
	cd frontend && npm run typecheck

# Regenerate the OpenAPI contract after changing a serializer (CI checks it).
schema:
	cd backend && uv run python manage.py spectacular --file openapi.yaml --validate --fail-on-warn
