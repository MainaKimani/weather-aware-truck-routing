# Local development. `make dev` runs both apps natively; `make up` uses Docker.
# Lint, format and type gates are filled in by SPOT-11.

.PHONY: install dev api web up down test lint types

install:
	cd backend && uv sync
	cd frontend && npm ci

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
	cd backend && uv run pytest
	cd frontend && npm run build

lint:
	cd backend && uv run python manage.py check
	cd frontend && npm run lint

types:
	cd frontend && npx tsc -b
