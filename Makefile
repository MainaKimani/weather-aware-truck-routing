# Local development. `make dev` runs both apps natively; `make up` uses Docker.

.PHONY: install hooks dev api web up down test lint fmt types

install:
	cd backend && uv sync
	cd frontend && npm ci
	$(MAKE) --no-print-directory hooks

hooks:
	uv run --project backend pre-commit install

dev:
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
