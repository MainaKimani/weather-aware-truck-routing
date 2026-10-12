# Tasks: Weather-Aware Truck Routing

Project tracker for the Spotter assessment. It plays the role of Jira: plan here, update as work
moves. Specs live in [PRD.md](./PRD.md) and [RFC-001](./RFC-001-weather-aware-routing.md); tasks
link to their sections instead of repeating them.

## How to use this file

- **Status:** `To do` → `In progress` → `In review` → `Done`. `Blocked` needs a note saying on what.
- **Effort:** the area (Backend, Frontend, Full stack, DevOps, Docs) and a size in points
  (1 ≈ an hour or two, 2 ≈ half a day, 3 ≈ a day, 5 ≈ two days, 8 = too big, split it).
- **Priority:** P0 must ship, P1 should ship, P2 stretch (matches PRD §5).
- **Updating:** when a task changes, update its row in the board **and** add a dated line to its
  progress log saying what was done, what's left and any decision made. Tick sub-tasks as they
  finish. Branch names may carry the task id; commit messages and code comments don't. They
  say what changed and why in plain words, e.g. `feat(risk): raise wind risk for heavy loads`.
- **Done means** every acceptance criterion is met, tests pass in CI, and the progress log says so.
- **Branches:** backend work goes on `dev-backend`, frontend work on `dev-frontend`. Feature
  branches merge into a dev branch, and `main` accepts PRs only from `dev-backend` or
  `dev-frontend` (enforced by the `branch policy` CI job). Every merge needs a PR with `ci-ok`
  green. Full-stack tasks land their backend half first. After each merge to `main`, merge
  `main` back into both dev branches so they don't drift.
- **CI:** `.github/workflows/ci.yml` is the only entry point. It detects which side changed and
  calls `backend.yml` and/or `frontend.yml`. `ci-ok` always runs and is the one check to mark as
  required, so a side skipped for having no changes never leaves a check pending.

## Board

| ID       | Task                                              | Epic                 | Effort         | Pri | Status      |
| -------- | ------------------------------------------------- | -------------------- | -------------- | --- | ----------- |
| SPOT-1   | Assess brief, write PRD                           | E0 Planning          | Docs · 2       | P0  | Done        |
| SPOT-2   | Write technical RFC                               | E0 Planning          | Docs · 3       | P0  | Done        |
| SPOT-3   | Write UI prototype prompts (Lovable, AI Studio)   | E0 Planning          | Docs · 1       | P0  | Done        |
| SPOT-4   | Build UI prototype in AI Studio and review        | E0 Planning          | Frontend · 2   | P0  | Done        |
| SPOT-10  | Monorepo scaffold and local dev                   | E1 Foundation        | DevOps · 2     | P0  | Done        |
| SPOT-11  | Quality gates (lint, types, pre-commit)           | E1 Foundation        | DevOps · 1     | P0  | Done        |
| SPOT-12  | CI pipeline                                       | E1 Foundation        | DevOps · 2     | P0  | Done        |
| SPOT-13  | Settings and configuration                        | E1 Foundation        | Backend · 1    | P0  | Done        |
| SPOT-14  | Postgres and custom user model                    | E1 Foundation        | Backend · 1    | P0  | Done        |
| SPOT-20  | Units and geo utilities                           | E2 Domain            | Backend · 2    | P0  | Done        |
| SPOT-21  | Checkpoint sampling and owned miles               | E2 Domain            | Backend · 2    | P0  | Done        |
| SPOT-22  | ETA interpolation                                 | E2 Domain            | Backend · 2    | P0  | Done        |
| SPOT-23  | Risk classification and load rules                | E2 Domain            | Backend · 3    | P0  | Done        |
| SPOT-24  | Hours of Service planner                          | E2 Domain            | Backend · 5    | P1  | Done        |
| SPOT-25  | Route metrics                                     | E2 Domain            | Backend · 2    | P0  | Done        |
| SPOT-26  | Ranking and recommendation reason                 | E2 Domain            | Backend · 2    | P0  | Done        |
| SPOT-30  | Provider protocols, fakes and demo scenarios      | E3 Providers         | Backend · 3    | P0  | Done        |
| SPOT-31  | HERE truck routing adapter                        | E3 Providers         | Backend · 3    | P0  | Blocked     |
| SPOT-32  | Route alternatives: dedupe and via-point fallback | E3 Providers         | Backend · 3    | P0  | Done        |
| SPOT-33  | HERE autosuggest adapter                          | E3 Providers         | Backend · 1    | P0  | Done        |
| SPOT-34  | Open-Meteo forecast adapter                       | E3 Providers         | Backend · 3    | P0  | Done        |
| SPOT-35  | Forecast cache                                    | E3 Providers         | Backend · 3    | P0  | Done        |
| SPOT-36  | Provider resilience                               | E3 Providers         | Backend · 2    | P0  | Done        |
| SPOT-40  | Plan service orchestration                        | E4 API               | Backend · 3    | P0  | Done        |
| SPOT-41  | `POST /api/v1/plans` endpoint                     | E4 API               | Backend · 2    | P0  | Done        |
| SPOT-42  | Corridor grid and heatmap endpoint                | E4 API               | Backend · 3    | P0  | In progress |
| SPOT-43  | Geocode suggest endpoint                          | E4 API               | Backend · 1    | P0  | Done        |
| SPOT-44  | OpenAPI schema and TS type generation             | E4 API               | Full stack · 1 | P0  | Done        |
| SPOT-45  | Security settings, throttling, health checks      | E4 API               | Backend · 2    | P0  | Done        |
| SPOT-46  | Structured logging and request ids                | E4 API               | Backend · 1    | P0  | Done        |
| SPOT-50  | App shell, theme and design tokens                | E5 Frontend base     | Frontend · 2   | P0  | Done        |
| SPOT-51  | API client, query layer and UI state              | E5 Frontend base     | Frontend · 2   | P0  | In progress |
| SPOT-60  | Trip form with autosuggest                        | E6 Planning UI       | Frontend · 3   | P0  | Done        |
| SPOT-61  | Hours of Service fields                           | E6 Planning UI       | Frontend · 2   | P1  | Done        |
| SPOT-62  | Route cards and recommendation                    | E6 Planning UI       | Frontend · 3   | P0  | Done        |
| SPOT-63  | Checkpoint table                                  | E6 Planning UI       | Frontend · 2   | P0  | Done        |
| SPOT-64  | Empty, loading, partial and error states          | E6 Planning UI       | Frontend · 2   | P0  | Done        |
| SPOT-70  | Map view, basemap and camera                      | E7 Map               | Frontend · 2   | P0  | Done        |
| SPOT-71  | Routes layer with risk-coloured segments          | E7 Map               | Frontend · 3   | P0  | Done        |
| SPOT-72  | Checkpoints layer, tooltip and popup              | E7 Map               | Frontend · 3   | P0  | Done        |
| SPOT-73  | HOS stops layer                                   | E7 Map               | Frontend · 1   | P1  | Done        |
| SPOT-74  | Legend and layer toggles                          | E7 Map               | Frontend · 1   | P0  | Done        |
| SPOT-80  | Corridor heatmap layer                            | E8 Heatmap           | Frontend · 3   | P0  | To do       |
| SPOT-81  | 48-hour slider and playback                       | E8 Heatmap           | Frontend · 3   | P0  | To do       |
| SPOT-82  | Truck position while scrubbing                    | E8 Heatmap           | Frontend · 2   | P1  | To do       |
| SPOT-83  | Heatmap metric switcher                           | E8 Heatmap           | Full stack · 2 | P1  | To do       |
| SPOT-90  | End-to-end smoke test                             | E9 Hardening         | Full stack · 2 | P0  | To do       |
| SPOT-91  | Accessibility pass                                | E9 Hardening         | Frontend · 2   | P0  | To do       |
| SPOT-92  | Performance check against budgets                 | E9 Hardening         | Full stack · 2 | P0  | To do       |
| SPOT-100 | Deploy backend and Redis                          | E10 Delivery         | DevOps · 2     | P0  | To do       |
| SPOT-101 | Deploy frontend                                   | E10 Delivery         | DevOps · 1     | P0  | To do       |
| SPOT-102 | README                                            | E10 Delivery         | Docs · 2       | P0  | To do       |
| SPOT-103 | Loom walkthrough                                  | E10 Delivery         | Docs · 2       | P0  | To do       |
| SPOT-110 | Trip models, constraints, migrations and admin    | E11 Trips & accounts | Backend · 3    | P0  | To do       |
| SPOT-111 | Save plans as trips                               | E11 Trips & accounts | Backend · 2    | P0  | To do       |
| SPOT-112 | Guest identity and access layer                   | E11 Trips & accounts | Backend · 2    | P0  | To do       |
| SPOT-113 | Trip read endpoints                               | E11 Trips & accounts | Backend · 2    | P0  | To do       |
| SPOT-114 | Accounts (sign up, log in, log out, session)      | E11 Trips & accounts | Backend · 3    | P1  | To do       |
| SPOT-115 | Move guest trips into the account on sign-in      | E11 Trips & accounts | Backend · 1    | P1  | To do       |
| SPOT-116 | Trip actions API                                  | E11 Trips & accounts | Backend · 2    | P1  | To do       |
| SPOT-117 | Delete account                                    | E11 Trips & accounts | Backend · 1    | P1  | To do       |
| SPOT-118 | Retention purge                                   | E11 Trips & accounts | Backend · 1    | P0  | To do       |
| SPOT-119 | Demo account seed                                 | E11 Trips & accounts | Backend · 1    | P1  | To do       |
| SPOT-120 | Routing and session handling                      | E11 Trips & accounts | Frontend · 2   | P0  | To do       |
| SPOT-121 | Trip page                                         | E11 Trips & accounts | Frontend · 2   | P0  | To do       |
| SPOT-122 | Recent trips menu (guest)                         | E11 Trips & accounts | Frontend · 1   | P0  | To do       |
| SPOT-123 | Log in and sign-up pages                          | E11 Trips & accounts | Frontend · 2   | P1  | To do       |
| SPOT-124 | My trips page                                     | E11 Trips & accounts | Frontend · 3   | P1  | To do       |
| SPOT-125 | Trip actions UI                                   | E11 Trips & accounts | Frontend · 2   | P1  | To do       |
| SPOT-126 | Account page                                      | E11 Trips & accounts | Frontend · 1   | P1  | To do       |

**Totals:** 70 tasks · P0 116 points, P1 28 points. Done: 29 (60 points).

## Open items

Everything skipped, blocked or handed on, in one place. Each item is also in the progress log
of the task it came from, and as a sub-task on the task that will pick it up. Remove an item
here when that task closes it.

**Blocked**
- **SPOT-31 (and SPOT-33's live check): no HERE API key.** Both adapters pass against
  synthetic fixtures shaped to HERE's documented responses; neither has made a real request.
  Needs the PRD Q3 decision (HERE's Base Plan needs a card; free allowance unconfirmed), then
  a key in `HERE_API_KEY` and one real Dallas → Denver request.

**Waiting on the owner**
- PRD Q3: paid routing tier (see Blocked).

**Branch housekeeping**
- `dev-frontend` is behind `main`; merge `main` into it before frontend work starts.

**Carried over to a later task**

| From | What's left | Picked up in |
|---|---|---|
| SPOT-41 | Plan response has no `trip_id`; plans aren't saved. Add it (and `Idempotency-Key`), then `make schema`. | SPOT-111 |
| SPOT-42 | `GET /api/v1/trips/{id}/heatmap`: store the grid as `TripHeatmap`, same access as the trip, `heatmap` throttle scope. | SPOT-42, once trips exist (SPOT-111) |
| SPOT-45 | Guest plan throttle counts by IP only; count by session `guest_id` too. | SPOT-112 |
| SPOT-45 | Set `NUM_PROXIES` to the real proxy chain (Vercel rewrite + host); point host checks at `/healthz` and `/readyz`. | SPOT-100 |
| SPOT-35 | Forecast cache and `/readyz` only tested on local memory; run against real Redis. | SPOT-100 |
| SPOT-10 | Choose a licence. | SPOT-102 |
| SPOT-10 | Run `make up` once with Docker. | SPOT-100 |
| SPOT-51 | Dependent heatmap query (starts after the plan resolves); the endpoint and its schema don't exist yet. | SPOT-51, once SPOT-42's endpoint lands |
| SPOT-74 | Heatmap switch in the map legend; the heatmap layer doesn't exist yet. | SPOT-80 |
| SPOT-50 | Nothing calls `/api/v1/healthz` any more (hosts use `/healthz`); remove the route and its test. | Next backend change |

## Epics

| Epic | Goal | Graded under |
|---|---|---|
| E0 Planning | Agree what we're building and how | Docs 5% |
| E1 Foundation | Repo, tooling and CI so everything after is checked automatically | Code quality 10% |
| E2 Domain | The rules: sampling, ETAs, risk, HOS, metrics, ranking, all pure and tested | Logic 40% |
| E3 Providers | Routing, geocoding and weather behind adapters, cached and resilient | Logic 40% |
| E4 API | HTTP layer, contract, security and operability | Logic 40%, code quality 10% |
| E5 Frontend base | Shell, theme, typed client, state | UI 35% |
| E6 Planning UI | Form, results, states | UI 35% |
| E7 Map | Routes, checkpoints, stops on a fast map | UI 35% |
| E8 Heatmap | Corridor heatmap and a smooth 48 h slider | UI 35% |
| E9 Hardening | Prove it works, is accessible and meets the budgets | All |
| E10 Delivery | Hosted app, README, video | Docs 5% |
| E11 Trips & accounts | Save every plan as a trip; guests and signed-in users; My trips, sharing | Code quality 10%, UI 35% |

**Suggested order:** E1 → E2 → E3 → E4 → E11 (P0 tasks) on the backend while SPOT-4 settles the
design; then E5 → E6/E7 → E8 → E11 (P0 frontend) → E9 → E10. P1 tasks, including accounts, only
after every P0 in E9 is done.

---

## E0 Planning

### SPOT-1 · Assess brief, write PRD

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Docs · 2 | P0 | Done | — |

**Sub-tasks**
- [x] Read the brief and extract requirements, rules and grading weights.
- [x] List the ambiguities (overlapping thresholds, gust vs sustained, No Travel in ranking,
  miles per level, travel-time tie-break, load-rule gap) and decide each one.
- [x] Write `docs/PRD.md`: users, scope P0/P1/P2, functional and non-functional requirements,
  UX outline, assumptions, open questions.

**Acceptance criteria**
- Every requirement in the brief maps to a P0 item.
- Every ambiguity has a written decision (PRD §11).

**Progress log**
- 2026-10-11: PRD written. Decisions taken with the user: risk uses **gusts**; HOS is an
  **optional toggle, off by default**, covering 11 h, 14 h, 30 min and 60/70 h rules. Open:
  paid routing tier (Q3).
- 2026-10-11: Added §7.9 Trips, guests and accounts: every plan saved as a trip; guests plan
  without signing up; guest trips move into the account on sign-in; My trips, save, share.
  Accounts are P1 behind the core.

### SPOT-2 · Write technical RFC

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Docs · 3 | P0 | Done | SPOT-1 |

**Sub-tasks**
- [x] Architecture, repo layout, provider selection (HERE, Open-Meteo, MapLibre).
- [x] Domain algorithms: sampling, ETA, forecast lookup, risk, HOS planner, metrics, ranking.
- [x] API contract, corridor grid, caching, frontend design, errors, security, testing, deploy.
- [x] Engineering quality section (scalability, reliability, data integrity, maintainability).

**Acceptance criteria**
- Someone new can build the system from the RFC without asking how a rule is applied.

**Progress log**
- 2026-10-11: RFC-001 written. Added §6.2.1 HOS planner and §18 Engineering quality
  (single-flight cache fills, circuit breaker, stale-while-revalidate, health checks,
  versioned cache keys, provenance fields).
- 2026-10-11: Added §3.1 data model (Trip, TripRoute, TripHeatmap with DB constraints), §3.2
  identity (Django sessions via allauth headless, guest_id, claim on login, one-origin deploy),
  §7.4–7.5 trip and account endpoints, idempotent `POST /plans`. Old shareable-URL task
  replaced by real trip links (SPOT-125).

### SPOT-3 · Write UI prototype prompts (Lovable, AI Studio)

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Docs · 1 | P0 | Done | SPOT-2 |

**Sub-tasks**
- [x] Prompt covering layout, every screen and state, risk palette, map layers and heatmap
  method, typed mock data matching the API contract, demo scenarios.

**Acceptance criteria**
- Prompt produces a frontend-only prototype using the RFC's types and map library.

**Progress log**
- 2026-10-11: `docs/lovable-prompt.md` written.
- 2026-10-11: Prompt extended with guest/signed-in header, login, sign-up, My trips, trip page
  and account page, all mocked in the browser.
- 2026-10-11: Lovable credits used up, so switched to Google AI Studio. Added
  `docs/ai-studio-prompt.md` (same spec, adapted: no Gemini calls, maplibre-gl directly,
  HashRouter, no component library) and `docs/ai-studio-followups.md` (5 targeted fix-up
  prompts).

### SPOT-4 · Build UI prototype in AI Studio and review

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | Done | SPOT-3 |

**Sub-tasks**
- [x] Run `docs/ai-studio-prompt.md` in AI Studio (Build); fix weak areas with the prompts in
  `docs/ai-studio-followups.md`.
- [x] Review against PRD §7–§9: every screen and state present, palette and labels right,
  including guest vs signed-in header, login/sign-up, My trips and the trip page.
- [x] Decide what to keep: layout, components, tokens. Record changes to the PRD/RFC if the
  design changes a requirement.
- [x] Download the AI Studio project (or push it to GitHub) for reference in SPOT-50.

**Acceptance criteria**
- An agreed visual design exists for every state in PRD §9.
- Any requirement changes are written back into the PRD.

**Progress log**
- 2026-10-11: Prototype built in AI Studio and published at
  <https://spotter-weather-routing.ai.studio>. Reviewed every screen and state against PRD §7–§9:
  planning (both presets, with and without HOS), the error preset, slider, layers, checkpoint
  table, Recent trips, login, My trips and account. Findings are in
  [design-review.md](./design-review.md): what to keep per task, plus 10 fixes for the real build.
  The biggest is that the heatmap must be the RFC §8 corridor grid, not blurred blobs. No
  requirement changes, so the PRD is unchanged.
- Left: owner to agree the review, and export the AI Studio project for reference in SPOT-50.
- 2026-10-12: Done at the owner's call. The optional AI Studio export moves to SPOT-50.

---

## E1 Foundation

### SPOT-10 · Monorepo scaffold and local dev

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| DevOps · 2 | P0 | Done | — |

**Sub-tasks**
- [x] `git init`, `.gitignore`, `.editorconfig`, licence. _(licence pending owner's choice)_
- [x] `backend/`: Django 5 project `config/` with app `planner/` laid out as RFC §4
  (`domain/`, `providers/`, `services/`, `api/`); dependencies managed with uv (`uv.lock`).
- [x] `frontend/`: Vite + React + TypeScript (strict) + Tailwind; `package-lock.json`.
- [x] `docker-compose.yml` with `api`, `postgres`, `redis`, `web`; `Makefile` with `dev`, `test`, `lint`,
  `fmt`, `types`. _(`fmt` deferred to SPOT-11, which brings the formatters)_
- [x] `.env.example` for both apps.

**Acceptance criteria**
- From a clean clone, `make dev` starts API, Postgres, Redis and web; the web page loads and calls a
  stub `/api/v1/healthz`.
- No secrets in the repo.

**Progress log**
- 2026-10-11: Scaffolded `backend/` (Django 5.2, DRF, django-environ, psycopg; uv) with
  `config/`, `planner/{domain,providers,services,api}` and an empty `accounts/` app; stub
  `GET /api/v1/healthz` with a pytest. `frontend/` is Vite 8 + React 18 + TS (strict,
  `noUncheckedIndexedAccess`) + Tailwind 4; the placeholder page calls `/api/v1/healthz` through
  the Vite `/api` proxy (same-origin, RFC §3.2). Added root `Makefile`, `docker-compose.yml`,
  `.editorconfig` and `.env.example` files.
- Verified: `make dev` serves the web app on :5173 and `/api/v1/healthz` returns `{"status":"ok"}`
  through the proxy; `make test` passes. **Not verified:** `make up` (Docker isn't installed on
  this machine). Native `make dev` doesn't start Postgres or Redis. The DB stays unmigrated and
  defaults to in-memory SQLite until SPOT-14 adds the custom user model.
- Left: choose a licence; run `make up` once on a machine with Docker.
- 2026-10-11: `make fmt` added by SPOT-11.
- 2026-10-12: Done. The licence moves to SPOT-102 and the Docker `make up` check to SPOT-100.

### SPOT-11 · Quality gates (lint, types, pre-commit)

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| DevOps · 1 | P0 | Done | SPOT-10 |

**Sub-tasks**
- [x] ruff (lint + format) including `DTZ` (no naive datetimes), `B`, `UP`, `I`, `S` rules.
- [x] mypy: strict for `planner/domain` and `planner/providers`, normal elsewhere.
- [x] eslint + prettier + `tsc --noEmit`; `noUncheckedIndexedAccess` on.
- [x] pre-commit hooks for all of the above; commit-msg check for Conventional Commits.

**Acceptance criteria**
- A naive `datetime.now()` in backend code fails lint.
- `make lint types` passes on the scaffold; pre-commit blocks a failing commit.

**Progress log**
- 2026-10-11: Backend: ruff (E, W, F, I, B, UP, S, DTZ, SIM, RUF; line length 100) and mypy
  with django-stubs/drf-stubs, `strict` for `planner.domain.*` and `planner.providers.*`.
  Frontend: replaced the template's oxlint with eslint (typescript-eslint `strictTypeChecked`,
  react-hooks, react-refresh) + prettier, as the tracker specified; `strict` and
  `noUncheckedIndexedAccess` in both tsconfigs. `.pre-commit-config.yaml` runs the project's own
  pinned tools (local hooks) plus the standard hygiene hooks; `scripts/check_commit_msg.py` is the
  commit-msg check. Makefile gained `hooks` and `fmt`, and `lint`/`types` now cover both apps.
- Verified: `make lint types` passes; a staged `datetime.now()` fails the ruff hook with DTZ005;
  the commit-msg hook rejects `added some stuff` and a subject ending in a period, and accepts
  Conventional Commit and merge subjects. Strict mypy flags an unannotated function in `domain/`.
- Left: moves to Done once SPOT-12 runs the same gates in CI.
- 2026-10-11: CI ran the same gates green on GitHub (`88e5017`). Done.
- 2026-10-11 (SPOT-14): mypy 2.4 applied the per-module `strict` override to the whole project,
  so the code was already strict everywhere. The config now sets `strict = true` globally to
  say so.

### SPOT-12 · CI pipeline

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| DevOps · 2 | P0 | Done | SPOT-11 |

**Sub-tasks**
- [x] GitHub Actions: backend job (ruff, mypy, pytest with coverage), frontend job (eslint,
  tsc, vitest, build).
- [x] Dependency audit job (`pip-audit`, `npm audit --audit-level=high`).
- [x] OpenAPI drift check (added in SPOT-44). _(a pytest that CI runs: `tests/api/test_openapi.py`)_
- [x] Cache dependencies; run on push and PR.

**Acceptance criteria**
- CI runs on every push and PR and fails on any gate.
- Coverage for `planner/domain` reported and ≥ 95%.

**Progress log**
- 2026-10-11: `.github/workflows/ci.yml` with four jobs on push to `main` and on PRs:
  `backend` (ruff, ruff format, mypy, pytest with coverage, then `planner/domain` ≥ 95%),
  `frontend` (eslint, prettier, tsc, vitest, build), `audit` (`pip-audit --strict` on the
  exported lockfile, `npm audit --audit-level=high`) and `commits` (runs
  `scripts/check_commit_msg.py` on every commit in a PR). uv and npm caches are keyed on the
  lockfiles; Node comes from `frontend/.nvmrc`. Added vitest + Testing Library with two App tests,
  and pytest-cov. `make test` now runs pytest with coverage and vitest.
- Coverage is configured with `source`, so domain modules no test imports still count against
  the 95% gate; while `domain/` is empty, the gate passes.
- Verified locally: every CI step passes and actionlint accepts the workflow. **Not verified:**
  a run on GitHub (nothing pushed yet).
- Left: first green run on GitHub, which also moves SPOT-10 (bar the licence and Docker check)
  and SPOT-11 to Done; OpenAPI drift check in SPOT-44.
- 2026-10-11: First run on GitHub passed for `88e5017`. Done; the drift check is tracked in
  SPOT-44.
- 2026-10-11: Restructured for the dev-branch flow. `ci.yml` now runs on pushes to `main`,
  `dev-backend` and `dev-frontend` and on all PRs. Its jobs: `branch policy` (PRs into `main`
  only from `dev-*`; PRs only target `main` or `dev-*`), `detect changes` (git diff; shared
  files such as CI, Makefile and hooks count as both sides; a new branch runs everything), the
  reusable `backend.yml` and `frontend.yml` (each with its own dependency audit), `conventional
  commits`, and the `ci-ok` aggregate. Simulated locally: all six branch pairs and five diff
  cases behave as intended. Branch rulesets requiring `ci-ok` are set in the GitHub UI.

### SPOT-13 · Settings and configuration

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | Done | SPOT-10 |

**Sub-tasks**
- [x] Split settings `base/local/prod`; all config from env (12-factor) with typed parsing
  (`django-environ`).
- [x] Cache: `django-redis` when `REDIS_URL` is set, `LocMemCache` otherwise.
- [x] `RULES_VERSION` constant in `domain/` (used by responses and cache keys).
- [x] Fail at startup if a required prod setting is missing.

**Acceptance criteria**
- The app refuses to start in prod without `DJANGO_SECRET_KEY`, `HERE_API_KEY`, `DATABASE_URL`,
  `REDIS_URL`, `CSRF_TRUSTED_ORIGINS`.
- Local dev runs with no `.env` beyond the example.

**Progress log**
- 2026-10-11: `config/settings/` split into `base` (everything shared, all from env),
  `local` (reads `backend/.env` if present, dev defaults, `DEBUG` on) and `prod` (no `.env`,
  `DEBUG` off). `manage.py` and pytest default to `local`; `wsgi`/`asgi` default to `prod`.
  `prod` collects every missing required variable (blank counts as missing) and raises one
  `ImproperlyConfigured` naming them all. It also requires `DJANGO_ALLOWED_HOSTS`, which the
  acceptance criteria leave out but prod can't serve without. Cache: `django-redis` when `REDIS_URL` is set
  (`IGNORE_EXCEPTIONS`, 2 s socket timeouts, so a Redis outage means cache misses rather than
  500s), `LocMemCache` otherwise. `RULES_VERSION = "1.0.0"` lives in
  `planner/domain/version.py`, with when-to-bump rules.
- Verified: 13 tests pass. Prod starts with all six variables and fails naming each one when it's
  missing. Local starts with an empty environment. A value in `.env` reaches `base`. Found and
  fixed: importing `base` before reading `.env` would have ignored `.env` entirely, and
  django-environ keeps inline `# comments` as part of the value, so `.env.example` keeps
  comments on their own lines.
- Left: HSTS, secure cookies and the proxy SSL header belong to SPOT-45. Done once CI is green.
- 2026-10-11: CI green on `dev-backend` (`25b710f`). Done.

### SPOT-14 · Postgres and custom user model

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | Done | SPOT-10, SPOT-13 |

Must be done **before the first `migrate`**: switching to a custom user model later means
rewriting migrations.

**Sub-tasks**
- [x] Postgres 16 via `DATABASE_URL` (`dj-database-url`), `CONN_MAX_AGE` with health checks;
  Postgres in `docker-compose.yml` and in CI.
- [x] `accounts` app with `User(AbstractUser)`: no username, unique case-insensitive email
  (RFC §3.1); `AUTH_USER_MODEL` set.

**Acceptance criteria**
- First migration creates `accounts.User`; tests run against Postgres in CI.

**Progress log**
- 2026-10-11: `accounts.User(AbstractUser)` with no username, email as `USERNAME_FIELD`, and
  `EmailUserManager`, which trims and lower-cases emails. A `Lower("email")` unique constraint
  is in the first migration. An email-based admin is registered. `DATABASES` comes from
  `DATABASE_URL` (default `postgres:///spotter`, the local socket) with `CONN_MAX_AGE=60` and
  `CONN_HEALTH_CHECKS`. CI's backend job runs a Postgres 16 service and checks
  `makemigrations --check`. `make dev` now migrates first (`make migrate`).
- Verified: 20 tests pass on local Postgres 16, including one that inserts `DRIVER@example.com`
  with raw SQL next to `driver@example.com` and gets an `IntegrityError` from the database.
  Admin login and healthz respond via runserver.
- Along the way: Django's generic admin and form classes needed `django-stubs-ext`'s
  `monkeypatch()` to be subscriptable at runtime. mypy turned out to apply the per-module
  `strict` override project-wide, so the config now says `strict = true` globally (see SPOT-11).
- Left: Done once CI is green.
- 2026-10-11: CI green on `dev-backend` (`25b710f`), Postgres service included. Done.

---

## E2 Domain (pure Python, no Django, no I/O)

### SPOT-20 · Units and geo utilities

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-10 |

**Sub-tasks**
- [x] `units.py`: km/h→mph, mm→in, cm→in, lb→kg, km→mi. Nothing else in the codebase
  converts units.
- [x] `geo.py`: haversine, cumulative polyline length, point at distance along a line,
  Douglas–Peucker simplify, local equirectangular buffer, point-in-polygon, lattice snapping.
- [x] Polyline encode/decode (precision 5) and HERE flexible polyline decode.

**Acceptance criteria**
- Conversions tested against known values; geo functions tested on known city pairs (within
  0.5% of reference distances).

**Progress log**
- 2026-10-11 (branch `feat/spot-20-units-geo`):
  - `units.py` holds the six conversions with exact factors.
  - `types.LatLon` is a NamedTuple.
  - `geo.py` has `haversine_mi` (IUGG mean radius), `cumulative_mi`, `point_at_mi`,
    `interpolate`, `distance_to_segment_mi`/`distance_to_line_mi`, an iterative Douglas-Peucker
    `simplify`, `snap`, and `lattice_near`.
  - `polyline.py` has a Google precision-5 `encode`/`decode` and `decode_flexible`.
- Decisions:
  - **Great-circle interpolation** in `point_at_mi`. Linear lat/lon was about 1% off on long
    segments; a property test caught it.
  - **The corridor buffer is distance-based, not a polygon.** `lattice_near` keeps lattice
    points within the radius of any segment, testing only each segment's padded bounding box.
    Building a buffer polygon and running point-in-polygon needs a polygon union, which we'd
    have to write without GEOS. This gives the same result with less code, so there's no
    point-in-polygon function.
  - **HERE's decoding uses HERE's official `flexpolyline` package**, as RFC §5.1 says, rather
    than a reimplementation. It's untyped, so it's wrapped in one typed function. Its header
    errors surface as `RuntimeError`, which the wrapper turns into `ValueError`.
  - Encoding rounds half up, like the reference algorithm (Python's `round` is half-to-even),
    and rounds absolute coordinates before taking deltas, so error doesn't accumulate.
- Verified: 66 domain tests, including hypothesis property tests (round trip, monotonic
  cumulative, Douglas-Peucker tolerance bound, snap idempotent).
  - Haversine is within 0.5% of WGS84 geodesic distances (geographiclib) for six city pairs,
    including LA–NY and Seattle–Miami.
  - `lattice_near` matches a brute-force scan exactly.
  - Google's and HERE's published example vectors decode correctly.
  - Domain coverage is 100%.
  - Benchmark: three 20k-vertex coast-to-coast routes simplify in 0.76 s; the lattice takes
    0.01 s and gives 1,126 points at 0.25°, over the ~700 cap, so SPOT-42 steps up to 0.5°
    (280 points).
- Left: PR into `dev-backend`.
- 2026-10-11: PR #1 merged into `dev-backend` with CI green, then into `main` (PR #2). Done.

### SPOT-21 · Checkpoint sampling and owned miles

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-20 |

Spec: RFC §6.1, PRD §7.3, §7.5.

**Sub-tasks**
- [x] Place checkpoints at 0, N, 2N … and always at the destination.
- [x] Owned miles (half-gap to each neighbour), scaled to the provider's reported distance.
- [x] Property tests with Hypothesis on random polylines.

**Acceptance criteria**
- Owned miles sum to the route distance (to 0.01 mi) for every generated polyline.
- Route shorter than N gives exactly two checkpoints (origin, destination).
- Intervals 10, 25 and 50 all work; anything else is rejected.

**Progress log**
- 2026-10-11 (branch `feat/spot-21-36-domain-providers`): `domain/sampling.py`.
  - `RouteGeometry` holds the polyline, its cumulative distances and a scale to the provider's
    reported distance; `position_at(mile)` maps a reported mile to a point.
  - `checkpoint_miles` gives 0, N, 2N, … then the destination, rejecting intervals other than
    10/25/50. `owned_miles` gives half the gap to each neighbour. `sample_checkpoints` puts
    them together.
- Decision: spacing is in **reported** miles, mapped onto the geometry by the scale, so
  checkpoint labels read 0, 25, 50 and line up with the route summary. RFC §6.1 spaces on the
  polyline and scales owned miles afterwards; the difference is only the scale factor, and
  this keeps labels round.
- Verified (24 tests): a Hypothesis property over random polylines, every interval and reported
  distances ±10% off the geometry, with owned miles summing to the reported distance within
  0.01 mi, all positive, and miles strictly increasing. A route shorter than N gives exactly
  two checkpoints. An exact multiple (50 mi every 25) doesn't duplicate the destination.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-22 · ETA interpolation

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-20 |

Spec: RFC §6.2.

**Sub-tasks**
- [x] Drive time at distance `d` from per-span durations; fallback to whole-route interpolation.
- [x] Reverse lookup: distance at drive time `t` (needed for HOS stop locations).
- [x] Forecast-hour selection: `ceil_to_hour(eta)` (RFC §6.3).

**Acceptance criteria**
- ETAs are non-decreasing along a route (property test).
- Forward then reverse lookup returns the original distance (to 0.01 mi).
- An ETA exactly on the hour selects that hour; one second past selects the next.

**Progress log**
- 2026-10-11: `domain/eta.py` and `types.Span`.
  - `DriveProfile.build(spans, distance, duration)` gives cumulative miles against cumulative
    seconds, scaled to the route's reported totals so the last ETA equals the reported
    duration. Without spans it falls back to a single span with `estimated=True`.
  - `drive_s_at(mile)` and `mile_at(seconds)` are piecewise-linear and clamped.
  - `eta(departure, seconds)` returns UTC, and `ceil_to_hour(t)` picks the forecast hour.
  - Naive datetimes are rejected.
- Decision: where a span takes no time (or has no length), a lookup lands at its far end. It's
  deterministic, and puts an HOS stop after a zero-time stretch rather than before it.
- Verified (18 tests):
  - Hypothesis: ETAs never decrease along random span lists, and forward then reverse returns
    the original distance within 0.01 mi.
  - An ETA exactly on the hour selects that hour; one second (or one microsecond) past selects
    the next.
  - Non-UTC and half-hour zones normalise to UTC hours.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-23 · Risk classification and load rules

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | Done | SPOT-20 |

Spec: PRD §7.4, RFC §6.4. **The highest-weighted logic in the assessment.**

**Sub-tasks**
- [x] `Level` enum, threshold tables, `band()` and `band_with_strict_top()`.
- [x] `apply_load_rules()` on gusts.
- [x] `classify()` returning `RiskResult` with every intermediate level, the driver and the
  load rule applied; missing forecast → `UNKNOWN`.
- [x] Table-driven tests written straight from the PRD table.

**Acceptance criteria**
- Tests at and either side of **every** boundary: gust 24.99/25/34.99/35/44.99/45/54.99/55;
  rain 0.0999/0.10/0.2499/0.25/0.4999/0.50/1.00/1.0001; snow 0.499/0.5/0.999/1.0/1.999/2.0/
  3.0/3.0001.
- Load rules: 30,000 vs 30,001 lb at gust 45 and 54.99; 40,000 vs 40,001 lb at gust 35 and
  44.99; gust 55 is No Travel at 1 lb.
- Gap case (gust 40, 35,000 lb) stays High.
- Driver tie-break order is wind, rain, snow.
- Sustained wind never changes the result (test with sustained 80, gust 10 → Low).

**Progress log**
- 2026-10-11: `domain/risk.py` and `types.Forecast`.
  - `Level` (IntEnum 0–4) and the band tables `WIND_MPH`, `RAIN_IN_HR`, `SNOW_IN_HR` with
    strict No Travel tops.
  - `LOAD_RULES` as data (`LoadRuleSpec`), applied by `apply_load_rules`.
  - `classify(forecast, load_lb)` returns a `RiskResult` with base and adjusted wind, rain,
    snow, the load rule, the overall level and the driver (tie order wind, rain, snow).
  - `UNKNOWN` is `level=None`. Missing, NaN, infinite or negative provider values count as
    missing.
- Decision (written into PRD §7.4): partial data is Unknown unless a known value is already
  No Travel. A gust of 60 mph with rain missing is No Travel, not Unknown, so a missing field
  can't make an undrivable point look drivable. Known values are still returned for display.
- Verified (62 tests, written from the PRD table):
  - Every acceptance boundary: gust 24.99–55, rain 0.0999–1.0001, snow 0.499–3.0001.
  - Load rules at 30,000/30,001 lb (gust 45 and 54.99) and 40,000/40,001 lb (gust 35 and
    44.99). Gust 55 is No Travel at 1 lb, and the 40 mph / 35,000 lb gap case stays High.
  - Tie-breaks, and sustained wind 80 with gust 10 rating Low.
  - Hypothesis: the level is the worst component, and a heavier load is never safer.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-24 · Hours of Service planner

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 5 | P1 | Done | SPOT-22 |

Spec: PRD §7.3.1, RFC §6.2.1.

**Sub-tasks**
- [x] `HosRules`, `HosClocks`, `Cycle`, `Stop`, `HosPlan` types in integer seconds.
- [x] Simulation loop with longest-stop-first ordering and an iteration guard.
- [x] `clock_offset(drive_s)`.
- [x] Map stops to miles and coordinates with the reverse lookup from SPOT-22.
- [x] Table tests and Hypothesis invariants.

**Acceptance criteria**
- Rested driver, 12 h drive: break at 8 h, rest at 11 h, arrival = 12 h + 0.5 h + 10 h.
- Driver starting with 3 h of shift left and 11 h drive left: rest when the window runs out.
- Cycle 5 h left on a 12 h trip: 34 h restart at 5 h.
- Limits coinciding produce one stop (the longest).
- A trip ending exactly on a limit adds no stop.
- Invariants: no driving stretch breaks any limit; `clock_offset` is monotonic; stops don't
  overlap.

**Progress log**
- 2026-10-11: `domain/hos.py`.
  - Types: `HosRules` (`DEFAULT_RULES`), `Cycle`, `HosClocks` (range-validated, with
    `rested()`), `StopKind`, `Stop` and `HosPlan`, with `clock_offset`, `trip_duration_s` and
    `count`. All in integer seconds.
  - `plan_hos` checks limits longest stop first, with a 1,000-iteration guard.
  - `place_stops` maps each stop to a mile (reverse ETA lookup), a position and a start time.
- Decision (written into RFC §6.2.1): if a 30 min break would use up the rest of the 14 h
  window, the planner takes the 10 h rest instead. That rest also counts as the break. Taken
  literally, the RFC loop scheduled a break and then a rest at the same point. As a result,
  stops are strictly increasing in driving time.
- Verified (23 tests):
  - Every acceptance scenario: rested 12 h trip (break at 8 h, rest at 11 h, +10.5 h), window
    exhausted at 3 h, cycle restart at 5 h, coinciding limits giving one stop, and a trip ending
    on a limit adding none.
  - Also: starting with no drive time, the 60 h cycle, and a 30 h trip.
  - Hypothesis, up to 120 h with random clocks: an independent replay checks that no driving
    stretch breaks any limit; stops are strictly ordered within the trip; `clock_offset` is
    monotonic and ends at `trip_duration_s`.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-25 · Route metrics

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-21, SPOT-23 |

Spec: PRD §7.5, RFC §6.5.

**Sub-tasks**
- [x] Miles by level including `UNKNOWN`; distance-weighted average risk excluding Unknown;
  worst level and its mile; drivable flag.

**Acceptance criteria**
- Miles by level sum to route distance.
- All-Unknown route has `avg_risk = None` and is not reported as safe.
- One No Travel checkpoint makes `drivable = false`.

**Progress log**
- 2026-10-11: `domain/metrics.py`. `route_metrics(checkpoints)` returns a `RouteMetrics`:
  - `miles_by_level`, over all six buckets including `UNKNOWN`;
  - the distance-weighted `avg_risk`, excluding Unknown and `None` when every checkpoint is
    Unknown;
  - `worst` and `worst_at_mile` (the first occurrence);
  - `drivable` (no No Travel checkpoint), `distance_mi`, `unknown_miles` and `unknown_share`
    (for SPOT-26's warning).
- Verified (8 tests): a hand-worked 75 mi route; Unknown is counted but kept out of the
  average; an all-Unknown route has no average and no Low miles; one No Travel checkpoint makes
  the route not drivable. Hypothesis: miles by level sum to the route distance, the average
  stays within 0–4, and drivable means no No Travel.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-26 · Ranking and recommendation reason

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-25 |

Spec: PRD §7.6, RFC §6.6.

**Sub-tasks**
- [x] Sort key: No Travel miles, Severe miles, High miles (rounded), quantised average risk,
  duration (trip duration when HOS is on).
- [x] Reason sentence from the first differing key against the runner-up.
- [x] No recommendation when no route is drivable; warning when > 20% Unknown.

**Acceptance criteria**
- One test per criterion where all earlier criteria tie and that one decides.
- Average risks 1.02 and 1.04 tie (same 0.05 step); travel time decides.
- Ranking is deterministic for identical routes (stable by route id).
- Reason text tested for each criterion.

**Progress log**
- 2026-10-11: `domain/ranking.py`. `rank_routes(candidates)` returns a `Ranking`:
  - `ranked`, sorted by `rank_key`: No Travel, Severe and High miles (whole miles, half up),
    `risk_step(avg)` in 0.05 bands, whole minutes of trip time, then route id;
  - `recommended_id`, plus `reason_code` and a `reason` sentence taken from the first criterion
    that differs against the runner-up;
  - `high_unknown` warnings when more than 20% of a route has no forecast.
  - No drivable route gives `no_drivable_route` with a "try a later departure" message; the
    routes are still ranked. A single route gives `only_route`.
- Decisions:
  - Risk bands use `floor(avg / 0.05)`, so 1.02 and 1.04 share a band as the acceptance criteria
    require. Rounding would split them (20 vs 21). An epsilon covers float error, since
    0.15 / 0.05 is 2.999….
  - Travel time compares in whole minutes, so a few seconds' difference falls through to
    route id rather than giving "0 min faster".
  - An all-Unknown average sorts after any known one: missing data never helps a route.
  - Reason sentences: "Fewest No Travel / severe / high-risk miles (a vs b)", "Lowest average
    risk (0.40 vs 1.20)", "Same risk, 25 min faster", "Same risk and travel time as the next
    route", "Only route found".
- Verified (27 tests): one test per criterion where every earlier one ties; 1.02 vs 1.04 ties
  and time decides; 1.04 vs 1.06 doesn't tie; rounded miles; Unknown average; deterministic
  order by id; no drivable route; single route; the 20% warning boundary; reason text for
  each criterion.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

---

## E3 Providers

### SPOT-30 · Provider protocols, fakes and demo scenarios

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | Done | SPOT-20 |

**Sub-tasks**
- [x] `RoutingProvider`, `WeatherProvider`, `Geocoder` protocols in `providers/base.py`.
- [x] Fakes: fixed Dallas → Denver routes and a deterministic moving-storm weather model
  (same story as the UI prototype prompts), plus the stronger "No Travel" scenario.
- [x] `PROVIDERS=fake|real` setting; responses flag `"demo": true` when fakes are used.

**Acceptance criteria**
- The whole app runs with no API keys and no network in fake mode.
- Demo scenario recommends Route A with "Fewest severe miles"; the strong scenario makes
  Route B not drivable.

**Progress log**
- 2026-10-11:
  - **Protocols** (`providers/base.py`): `RoutingProvider`, `WeatherProvider` and `Geocoder`,
    with `RouteRequest`, `Place` and a `ProviderError` family (`RoutingUnavailable`,
    `WeatherUnavailable`, `GeocodingUnavailable`, `NoRoute`, each with its API error code).
  - **Domain types:** `types.Route`, and `domain/forecast.ForecastSeries` (`at(hour)`,
    `for_eta(t)`).
  - **Fakes** (`providers/fakes.py`):
    - `FakeRouting` gives three scripted Dallas–Denver routes (via Amarillo, Wichita and
      Lubbock, as in the prototype), or a direct route plus two bowed ones for any other pair,
      and honours via points.
    - `FakeWeather` models storm cells as a pure function of place and time.
    - `FakeGeocoder` holds 15 cities with time zones.
  - **Selection:** `PROVIDERS=fake|real` (fake by default locally, real in prod) and
    `FAKE_SCENARIO=demo|strong`. `providers/registry.get_providers()` returns them with
    `demo=True` for fakes, and the API sets the response flag from that in SPOT-41.
  - `tests/pipeline.py` chains the domain modules for provider tests. SPOT-40 builds the real
    plan service.
- Decision: storm cells **circle** their centres instead of drifting. With drift, the result
  depended on exactly when the reviewer departed. Circling cells keep the heatmap moving and
  the outcome fixed.
- Verified: the scenario outcomes were checked by script over 19 departures in the 48 h window ×
  3 intervals × 4 loads (1 lb to 80,000 lb). Demo always recommends Route A for "Fewest severe
  miles"; strong always makes Route B not drivable. The tests keep a cross-section of that
  (33 tests).
- Fixed along the way: `geo.interpolate` returned the endpoints with float noise
  (-96.79700000000001); it now returns them exactly.
- Left: the `real` branch of the registry is wired in SPOT-31/33/34.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-31 · HERE truck routing adapter

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | Blocked | SPOT-30 |

Spec: RFC §5.1.

**Sub-tasks**
- [x] Request with `transportMode=truck`, gross weight in kg, `departureTime`,
  `alternatives=4`, polyline, summary and duration/length spans.
- [x] Parse to domain `Route`; reject responses missing geometry or durations.
- [x] Recorded-fixture tests with `respx`.
- [ ] Verify quota and free-tier terms; note result in progress log (PRD Q3).

**Acceptance criteria**
- A real Dallas → Denver request returns ≥ 2 routes with geometry, distance and spans.
- Changing load weight is passed through to the request (asserted in a test).

**Progress log**
- 2026-10-11:
  - `providers/http.py` holds the shared `HttpClient`: 3 s connect / 10 s read timeouts, and
    `HttpError` for transport failures, non-2xx responses and non-JSON bodies. SPOT-36 adds
    retries and the breaker.
  - `providers/here.py` holds `HereRouting`. It requests `transportMode=truck`, origin and
    destination, an ISO `departureTime`, `vehicle[grossWeight]` in kg (via `units.lb_to_kg`),
    `alternatives`, `return=polyline,summary,routeLabels`,
    `spans=dynamicSpeedInfo,length,duration`, and pass-through `via` points.
  - `parse_routes` decodes each section's flexible polyline, joins sections without repeating
    the join point, converts metres to miles, and labels routes from `routeLabels`
    ("via I-35, I-70"). Routes come back sorted fastest first.
  - An empty `routes` list raises `NoRoute` with HERE's notice. Missing geometry or durations
    raise `RoutingUnavailable`, never a zero-length route.
- Decision (written into RFC §5.1): spans are split by `dynamicSpeedInfo`. HERE's docs say
  `length` and `duration` never start a span on their own, so the original
  `spans=length,duration` would have given one span per section and lost every speed change.
- Verified (24 tests, respx): request parameters, load pass-through in kg (42,000 lb →
  19,051 kg; 80,000 → 36,287), via points, parsing, section joins, sections without spans, and
  malformed responses (no geometry, no duration, bad polyline, no sections). HTTP
  401/429/500/503, timeouts and non-JSON bodies all become `RoutingUnavailable`.
- **Not verified:** a real request. There's no HERE key, so the fixture is synthetic: shaped to
  HERE's documented response and built with `flexpolyline.encode`. The acceptance check "a real
  Dallas → Denver request returns ≥ 2 routes" is still open.
- **PRD Q3 (free tier), what I could confirm:** HERE retired the no-payment "Limited" plan on
  31 Aug 2025. The Base Plan needs a payment method at sign-up and has a monthly free
  allocation per service, but HERE's plans page wouldn't load (TLS error). Third-party sites
  quote ~30,000 transactions a month. Q3 stays open for the owner: a card on file with
  usage inside the free allocation, or a different router.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Blocked: the acceptance check needs
  a real HERE request, which needs a key and the PRD Q3 decision on the paid plan.

### SPOT-32 · Route alternatives: dedupe and via-point fallback

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | Done | SPOT-31 |

Spec: RFC §5.1.

**Sub-tasks**
- [x] Overlap measure on resampled polylines; drop routes > 85% overlapping a better one.
- [x] Via-point fallback at ±10% of trip length perpendicular to the midpoint.
- [x] `only_n_routes_found` warning when still short.

**Acceptance criteria**
- Two identical routes are reduced to one.
- When the provider returns 1 route, the fallback is tried and the result has up to 3 distinct
  routes or a warning.

**Progress log**
- 2026-10-11:
  - `domain/alternatives.py`: `overlap(a, b)` is the share of route A within 0.3 mi of route B,
    sampled every 2 mi. B's segments are bucketed in a 0.1° grid, so each sample checks only
    nearby segments. `is_duplicate` means more than 85%.
  - `services/routing.py`:
    - `find_routes(provider, request)` asks for 4 alternatives and keeps the fastest
      non-duplicates (at most 3).
    - When short, it requests routes through via points 10% of the trip length either side of
      the midpoint, then de-duplicates again.
    - When still short, it returns what it has with an `only_n_routes_found` warning.
    - A failed via request is skipped; a failed main request propagates.
  - `geo.offset_from_midpoint` replaces the private helper in the fakes, so both share it.
- Decision: overlap isn't symmetric. A detour that contains a whole short route overlaps it only
  partly, which is correct, since the detour is a real alternative.
- Verified (12 tests): identical and re-vertexed copies of a road overlap 100%; a road 10 mi
  away 0%; a shared first half 30–60%. Overlap on a coast-to-coast route with 10k vertices runs
  in under 2 s. Two identical routes reduce to one, the fallback fills the set to three, the
  fastest three are kept, a failed fallback gives the warning, and via points sit 10% either
  side of the midpoint.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-33 · HERE autosuggest adapter

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | Done | SPOT-30 |

**Sub-tasks**
- [x] Autosuggest call biased to North America; return label, lat, lon, time zone.
- [x] Fixture tests.

**Acceptance criteria**
- "dall" returns Dallas, TX first with coordinates and `America/Chicago`.

**Progress log**
- 2026-10-11: `providers/here_geocoder.py` holds `HereGeocoder.suggest(q, limit)`.
  - It sends `at` (centre of the contiguous US) with `in=countryCode:USA,CAN,MEX`; HERE needs a
    location focus alongside a country filter. It also sends `show=tz` and `lang=en-US`.
  - Queries under 2 characters return `[]` without calling HERE.
  - Results without a position (chain or category query suggestions) are skipped.
  - Labels drop ", United States" ("Dallas, TX"), and `timeZone.name` gives the IANA zone.
  - HTTP failures raise `GeocodingUnavailable`.
- Checked in HERE's docs: `show=tz` works on every Geocoding & Search endpoint except
  `/autocomplete`, so it works with Autosuggest.
- Verified (12 tests, respx): "dall" gives Dallas, TX first with coordinates and
  `America/Chicago`; request parameters; skipped query items; a missing time zone becomes
  `None`; a short query makes no call; HTTP 401/429/503 and malformed bodies are handled.
- **Not verified against the live API** (no key). The fixture is synthetic, shaped to HERE's
  documented response.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done against the fixture; the live
  check goes with SPOT-31's.

### SPOT-34 · Open-Meteo forecast adapter

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | Done | SPOT-30 |

Spec: RFC §5.2, §6.3.

**Sub-tasks**
- [x] Multi-location requests, ≤ 100 locations per batch, metric units, `unixtime`.
- [x] Parse to `Forecast` per hour: gust/sustained mph, rain = rain + showers in/hr, snow in/hr.
- [x] `null`/`NaN` → missing; out-of-range hours → missing.

**Acceptance criteria**
- Units converted only via `units.py` (asserted by a test on a fixture with known values).
- A fixture with a `null` gust gives `UNKNOWN` downstream, never Low.

**Progress log**
- 2026-10-11: `providers/open_meteo.py`.
  - Requests: `OpenMeteoWeather.hourly(points, start, hours)` batches at most 100 locations
    per request and runs batches in parallel (8 workers). Each request asks for wind, gusts,
    rain, showers, snowfall and weather code in km/h, mm and cm, with unixtime, GMT and
    `start_hour`/`end_hour`.
  - Parsing: `parse_forecasts` accepts a list or a single object (one location comes back
    without the list).
    - It checks `hourly_units` before converting with `units.py`.
    - Rain is rain + showers, and is missing if either is missing.
    - Null, NaN and boolean values, and hours outside the response, become missing, so they
      rate Unknown.
  - The `real` providers branch in the registry is now wired: HERE routing, HERE geocoder and
    Open-Meteo, needing `HERE_API_KEY`.
- Checked against the live API (no key needed):
  - Snowfall comes back in **cm** even with `precipitation_unit=mm`, so it's converted with
    `cm_to_in`.
  - Several locations return a JSON array; one location returns a plain object.
  - Errors are HTTP 400 `{"error": true, "reason": …}`.
- Verified (15 tests on a **recorded** 3-point fixture):
  - Unit conversion against known values (80.4672 km/h → 50 mph, 12.7 mm → 0.5 in,
    5.08 cm → 2 in), and a structural test that no conversion factor appears outside
    `units.py`.
  - A null gust rates Unknown, never Low; hours beyond the response are missing.
  - Changed units fail loudly, and a wrong location count is an error.
  - 250 points go out as batches of 100, 100 and 50, kept in order.
  - Live run: 120 points × 49 h in 1.2 s, with every point-hour rated.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

### SPOT-35 · Forecast cache

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | Done | SPOT-34, SPOT-13 |

Spec: RFC §9, §18.2, §18.3, §18.4.

**Sub-tasks**
- [x] Lattice snapping (0.1° checkpoints, 0.25° grid) and cache-first fetch of missing points.
- [x] Keys prefixed with `RULES_VERSION` and a payload schema version.
- [x] Single-flight: Redis `SET NX` lock per key, others wait up to 2 s for the value.
- [x] Stale-while-revalidate: keep entries 3 h past freshness; serve stale with a `stale` flag
  when the provider fails.

**Acceptance criteria**
- Second identical plan makes zero Open-Meteo calls (asserted with a counting fake).
- 10 concurrent requests for the same cold key make one upstream call.
- Provider down + stale entry → plan succeeds with `stale: true`.
- Bumping `RULES_VERSION` misses every old key.

**Progress log**
- 2026-10-11: `services/forecasts.py`. `ForecastStore(weather).get(points, step_deg)` returns a
  `ForecastLookup` (series by snapped point, `for_point`, `stale`, `oldest_fetch`).
  - **Snapping:** `CHECKPOINT_STEP_DEG` 0.1 and `GRID_STEP_DEG` 0.25.
  - **Keys:** `v{RULES_VERSION}:fc{SCHEMA_VERSION}:{lat:.2f}:{lon:.2f}:{YYYYMMDDHH}`, with -0.0
    normalised.
  - **Window:** each entry runs from an hour ago to ten days ahead (241 h), so any departure up
    to 7 days out plus a multi-day trip, and the heatmap's 0–48 h, share one entry.
  - **Lifetime:** fresh until the next hour, then kept 3 h more as a fallback.
  - **Single-flight:** a lock per key via `cache.add` (Redis `SET NX`), with waiters polling
    for up to 2 s. If the holder never delivers, a waiter fetches itself, and locks are released
    after a failure.
  - **Stale:** if the provider fails, the newest entry from the last 3 h is used and the result
    is flagged `stale`. With nothing to fall back on, it raises `WeatherUnavailable`.
  - Gaps (`None` series) aren't cached.
- Decision: if Redis is unreachable, django-redis with `IGNORE_EXCEPTIONS` returns `None` from
  `add()`. That's treated as "no lock to wait for", so a Redis outage doesn't add 2 s to every
  plan.
- Verified (14 tests on the local-memory cache):
  - A second identical request makes zero provider calls (counting fake), and 10 concurrent
    requests for a cold key make one.
  - Provider down with an entry two hours old gives `stale` and the same data; at 5 hours old,
    or with nothing cached, it raises `WeatherUnavailable`.
  - A new hour refetches, and bumping `RULES_VERSION` misses every old key.
  - Locks are released after failure, a waiter falls back to fetching, gaps aren't cached, and
    an unreachable cache doesn't wait.
- Left: the plan-level criterion "plan succeeds with `stale: true`" gets its end-to-end check
  in SPOT-40/41, which put `stale` in the response. Running against real Redis: SPOT-100
  (Docker isn't available here).
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done; the plan-level `stale`
  check moves to SPOT-40.

### SPOT-36 · Provider resilience

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-31, SPOT-34 |

Spec: RFC §18.3.

**Sub-tasks**
- [x] Shared `httpx` client with 3 s connect / 10 s read timeouts.
- [x] One retry with jitter on timeout and 5xx, GET only.
- [x] Per-provider circuit breaker (5 failures → open 30 s → half-open).
- [x] Map failures to `routing_unavailable` / `weather_unavailable`.

**Acceptance criteria**
- Tests: timeout retried once; 4xx not retried; breaker opens after 5 failures and fails fast;
  closes after a successful half-open call.

**Progress log**
- 2026-10-11: `providers/http.py`.
  - **Timeouts:** 3 s connect / 10 s read on the shared `HttpClient`.
  - **Retries:** one retry after a 0.1–0.4 s random pause, only on timeouts, transport errors
    and 5xx (every provider call is a GET). 4xx responses and bad JSON aren't retried.
  - **Breaker:** a `CircuitBreaker` per provider name, shared through `breaker_for`, since
    adapters are created per request. Five failed calls in a row open it for 30 s; then one
    trial call at a time is allowed (half-open). Success closes it; failure reopens it.
    `CircuitOpen` fails fast without a request.
  - **Error mapping:** adapters already turn `HttpError` into `routing_unavailable`,
    `weather_unavailable` or `geocoding_unavailable`, and `CircuitOpen` is an `HttpError`, so
    an open breaker surfaces with the same code.
- Decisions:
  - A 4xx counts as a success for the breaker. The provider answered; the request was wrong,
    and opening the breaker would block good requests.
  - A failed call counts once, even though it made two attempts.
  - The breaker is the API's only in-process state (RFC §18.2), so each worker trips on its own.
- Verified (17 tests): a timeout is retried once and gives up; 5xx then success; a connection
  error is retried; 400/401/404/429 and bad JSON make one call each. The breaker opens after 5
  failures with no request going out, stays open before 30 s, closes after a successful
  half-open call, reopens after a failed one, allows one trial at a time, isn't opened by 4xx,
  and resets its count on success. Open-Meteo surfaces an open breaker as
  `weather_unavailable`.
- Tests zero the retry pause (`tests/providers/conftest.py`), so the suite stays at about 10 s;
  one test checks the real jitter range.
- 2026-10-12: PR #3 merged into `dev-backend` with CI green. Done.

---

## E4 API

### SPOT-40 · Plan service orchestration

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | Done | SPOT-21–26, SPOT-32, SPOT-35 |

**Sub-tasks**
- [x] `plan_trip(request)`: routes → checkpoints → ETAs (+ HOS) → forecasts (one batched call
  across all routes) → risk → metrics → ranking.
- [x] Return domain objects; saving as a trip is SPOT-111.
- [x] Add `rules_version`, `generated_at`, `stale`, warnings.

**Acceptance criteria**
- End-to-end test with fakes reproduces the demo scenario exactly (golden JSON file).
- Forecasts for all three routes are fetched in one batched pass, not per route.
- Cold plan with fakes plus 300 ms simulated latency per provider call finishes in < 2 s.

**Progress log**
- 2026-10-12: `planner/services/plan.py` holds `plan_trip(request, providers, forecasts, clock)`.
  - **Pipeline:** `find_routes` → per route a `RouteGeometry`, checkpoints, a `DriveProfile`
    and, with HOS on, `plan_hos` → ETAs through `HosPlan.clock_offset` → one `ForecastStore.get`
    for every checkpoint of every route → `classify` → `route_metrics` → `rank_routes`, with
    HOS trip time as the duration → `place_stops`.
  - **Output** is domain objects: `Plan` with `PlannedRoute`s in rank order, each with its
    `Checkpoint`s (mile, owned miles, position, ETA, forecast, `RiskResult`), placed HOS
    stops, metrics, departure and arrival. It also carries `rules_version`, `generated_at`,
    `stale`, `forecast_as_of` (oldest fetch used) and `demo`.
  - **Ids and names** follow provider order, fastest first: `r1`–`r3` and Route A–C. They
    stay stable when ranking reorders the routes, so Dallas → Denver gives
    "Route A · via Amarillo", as in the design.
  - **Warnings:** `only_n_routes_found` (SPOT-32), `high_unknown` (> 20% Unknown, SPOT-26),
    `partial_forecast` for any smaller Unknown share (RFC §11 asks for a warning whenever some
    checkpoints have no data), and `eta_estimated` when a route has no speed spans.
- Decision: with HOS on, trip time is the exact drive time plus the planner's stops. The
  planner works in whole seconds, and using its rounded total left arrival half a second off
  the last checkpoint's ETA.
- Verified (16 tests, `tests/test_plan_service.py`):
  - **Golden file** `tests/golden/plan_demo.json`: the full demo plan (Dallas → Denver, 06:00
    CDT, 42,000 lb, every 25 mi) minus geometry. Route A is recommended, "Fewest severe miles
    (0 vs 100)". `tests/golden.py` compares it, and `UPDATE_GOLDEN=1` rewrites it.
  - **Batching:** one routing call and one weather call per plan for all three routes.
  - **Latency:** with 300 ms added to every provider call, a cold plan takes 0.8 s
    (limit 2 s).
  - **Stale:** with the provider down and an hour-old cache, the plan succeeds with
    `stale: true`, `forecast_as_of` set and the same recommendation. This closes SPOT-35's
    open criterion. With nothing cached, `WeatherUnavailable`; routing down,
    `RoutingUnavailable`.
  - **HOS on** gives a break and a rest on each route, shifts every later ETA by 10.5 h, and
    makes arrival equal the last ETA.
  - Missing forecasts are Unknown with a warning; ETAs read the hour being driven through;
    the strong scenario ranks Route B last as not drivable.
- `tests/conftest.py` now clears the cache around every test (it was local to the cache tests).
- 2026-10-12: Done; lands with the API PR into `dev-backend`.

### SPOT-41 · `POST /api/v1/plans` endpoint

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-40 |

Spec: RFC §7.2, §11.

**Sub-tasks**
- [x] Request/response serializers including HOS block and its cross-field rules.
- [x] Single error shape `{"error": {"code", "message", "fields"?}}` via a DRF exception handler.

**Acceptance criteria**
- Invalid interval, weight, departure window, identical origin/destination and each HOS rule
  return 400 `invalid_input` with the field named.
- `no_route` → 422; provider failures → 502 with the right code.

**Progress log**
- 2026-10-12: `POST /api/v1/plans` (`planner/api/views.py`, `serializers.py`, `errors.py`).
  - **Request:** `PlanRequestSerializer` validates origin and destination (lat/lon ranges,
    label, optional IANA `tz`), departure, load, interval and the HOS block, then builds a
    domain `PlanRequest`.
    - Departure must carry a UTC offset and fall within [now − 15 min, now + 7 days].
    - Origin and destination must be more than a mile apart.
    - HOS clocks arrive as hours with at most two decimals and become whole seconds. With HOS
      on, every clock is required, each within its limit, the cycle limit follows the chosen
      cycle (70 or 60 h), and drive ≤ min(window, cycle).
  - **Response:** output serializers read the domain `Plan` directly, in the RFC §7.2 shape:
    UTC times to the second, geometry re-encoded as a precision-5 polyline, rounded numbers,
    and the corridor bbox. They add `demo`, `forecast_as_of`, `reason_code`, `inputs` and,
    per route, `name`, `label` and `eta_estimated` (RFC §7.2 updated).
  - **Errors:** a DRF exception handler gives every failure the
    `{"error": {code, message, fields?}}` shape.
    - Nested validation errors get dotted names (`hos.drive_left_h`, `origin.lat`).
    - `NoRoute` → 422 `no_route`; other provider errors → 502 with their code, and the user
      message never echoes the provider's text.
    - Throttling → 429 `rate_limited`, keeping `Retry-After`. 404, 405 and the other DRF
      errors get codes too.
- Decisions:
  - A departure without an offset is rejected rather than read as UTC: a trip crossing zones
    makes a bare local time ambiguous.
  - With `hos.enabled: false`, the clocks are ignored rather than validated, so a form that
    keeps its last values still submits.
  - No `trip_id` yet: the plan isn't saved until SPOT-111, which adds the id and the
    `Idempotency-Key` handling.
- Verified (72 API tests):
  - Invalid interval (0, 5, 20, 30, 100, "25.5", null), weight (0, −1, 80,001, 1.5, text),
    departure (past, 7 days + 1 h, no offset, unparseable, empty), identical and
    < 1 mile apart places, out-of-range lat/lon, an unknown time zone, missing fields and
    malformed JSON all give 400 `invalid_input` with the field named.
  - Each HOS rule (each missing clock, each limit, 60 h cycle, drive > window, drive >
    cycle, 3 decimals, bad cycle, non-boolean `enabled`) names its `hos.*` field.
  - `no_route` → 422, `routing_unavailable` and `weather_unavailable` → 502.
  - The demo response's shape and geometry round trip.
  - The demo plan is 44 KB of JSON, 6.6 KB gzipped.
- 2026-10-12: Done; lands with the API PR into `dev-backend`.

### SPOT-42 · Corridor grid and heatmap endpoint

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | In progress | SPOT-40, SPOT-111 |

Spec: RFC §7.3, §8.

**Sub-tasks**
- [x] Union of simplified routes, 40 mi buffer, lattice points inside, point cap with coarser
  step.
- [x] Classify every point-hour (0–48) with `classify()` and the plan's load.
- [ ] `GET /api/v1/trips/{id}/heatmap`: compute from the stored trip on first request, save as
  `TripHeatmap`, read the saved copy afterwards; same access rules as the trip.

**Acceptance criteria**
- Coast-to-coast plan stays under the point cap.
- Payload for ~600 points < 20 KB gzipped.
- A grid point that equals a checkpoint location and hour has the same level as the checkpoint.

**Progress log**
- 2026-10-12: grid half done; the endpoint waits for SPOT-111.
  - `planner/services/corridor.py`: `corridor_points` simplifies each route (~1 km), takes
    lattice points within 40 mi of any route (`lattice_near`), and steps the lattice
    0.25° → 0.5° → 1° until there are at most 700 points.
  - `corridor_grid(lines, load_lb, store, clock)` fetches every point's forecasts in one
    cache-first batch at the lattice's own step, then classifies all 49 hours per point with
    `classify` and the plan's load. It returns `HeatmapGrid` with start hour, cell size, points,
    `risk[i][h]` (`None` = Unknown), `stale` and `forecast_as_of`.
  - `HeatmapSerializer` gives the RFC §7.3 shape: `[lon, lat]` points and integer levels,
    with null for Unknown.
- Decisions (RFC §7.3 updated):
  - Hours count from when the grid is computed, not from departure (PRD A10). Hour 0 is the
    hour in progress, read from the record stamped at its end, exactly as a checkpoint whose
    ETA falls in that hour would read it.
  - Without Redis, Django's local-memory cache kept only 300 entries, fewer than one heatmap
    needs, so the grid was refetched every time. It now holds 10,000 entries.
- Verified (16 tests in `tests/test_corridor.py`, plus one in `test_cache_config.py`):
  - **Point cap:** LA → New York and Seattle → Miami (three fake routes each) step to 0.5°
    and stay under the cap (580 and 662 points). Dallas → Denver keeps 0.25° (649 points).
    Points sit on the global lattice and within the buffer.
  - **Payload:** the strong-storm Dallas → Denver grid (649 points × 49 h) is under 20 KB
    gzipped.
  - **Grid matches checkpoints:** a plan whose checkpoints sit on lattice points has the same
    level on the grid at the same point and hour. Gusts vary by place and hour in that test,
    so reading the wrong point or hour would show.
  - Every sampled point-hour equals `classify` for three loads, and a heavier load raises
    No Travel cells (load rules apply).
  - Missing points are Unknown in every hour, and stale data is flagged.
  - One weather call per grid. A cached coast-to-coast grid is recomputed in about 1 s.
- Left: `GET /api/v1/trips/{id}/heatmap`, which stores the grid as `TripHeatmap` and shares
  the trip's access rules, needs trips (SPOT-110–112). Its throttle rate is set in SPOT-45.

### SPOT-43 · Geocode suggest endpoint

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | Done | SPOT-33 |

**Sub-tasks**
- [x] `GET /api/v1/geocode/suggest?q=`; min 2 characters; 24 h cache.

**Acceptance criteria**
- Query under 2 characters returns an empty list without calling the provider.

**Progress log**
- 2026-10-12: `GET /api/v1/geocode/suggest?q=` (`GeocodeSuggestView`, `services/geocoding.py`).
  - Queries are trimmed, lower-cased and whitespace-collapsed. Under 2 characters returns `[]`
    without calling the geocoder; `q` is required, and over 100 characters is
    `invalid_input`.
  - Up to five places as `{label, lat, lon, tz}`. `tz` was added to RFC §7.1, since the form's
    time-zone chip needs it.
  - Results are cached for 24 h under `geo1:<sha256 of the normalised query>`, because cache
    keys can't hold arbitrary user text. Failures aren't cached, and a geocoder failure is
    502 `geocoding_unavailable`.
- Verified (13 tests): "dall" gives Dallas, TX first with coordinates and `America/Chicago`.
  "", "d", " d " and whitespace return `[]` with no provider call. "Den", "  den " and "DEN"
  make one provider call. No matches is `[]`. A failure is 502 and the next request retries.
  The cache TTL is 24 h, and keys are ASCII for any input.
- 2026-10-12: Done; lands with the API PR into `dev-backend`.

### SPOT-44 · OpenAPI schema and TS type generation

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Full stack · 1 | P0 | Done | SPOT-41 |

**Sub-tasks**
- [x] drf-spectacular schema at `/api/v1/schema`; committed `openapi.yaml`.
- [x] `openapi-typescript` generates `frontend/src/api/schema.ts`.
- [x] CI fails if the committed schema or generated types are out of date.

**Acceptance criteria**
- Renaming a response field without regenerating fails CI.

**Progress log**
- 2026-10-12: backend half done. The frontend half lands on `dev-frontend` after it's synced
  with `main` (full-stack tasks land their backend half first).
  - drf-spectacular 0.30 serves the schema at `GET /api/v1/schema`. The schema is committed as
    `backend/openapi.yaml`, and `make schema` regenerates it with `--validate --fail-on-warn`.
  - Request and response components are split, so the generated client gets separate input
    and output types. Their names read as types: `PlanRequest` / `Plan`, `Place`, `Hos`,
    `Route`, `Checkpoint`, `Error`.
  - Every fixed set of values is an enum: `RiskLevelEnum`, `RiskDriverEnum`, `LoadRuleEnum`,
    `ReasonCodeEnum`, `WarningCodeEnum`, `HosStopKindEnum`, `HosStopReasonEnum`, `CycleEnum`,
    `IntervalMiEnum`. They come from the domain's `Literal` types, so adding a value updates
    the schema.
  - Both operations document their error responses with the shared `Error` shape (400, 422,
    429, 502). Health checks are left out of the schema.
  - The suggest endpoint now returns the same `Place` shape as the plan's inputs; its own
    duplicate serializer is gone.
- Verified: `tests/api/test_openapi.py` regenerates the schema and compares it with the
  committed file. Renaming `eta_estimated` without regenerating fails it with "run
  `make schema`", and restoring the name passes. Since CI runs pytest, CI fails on drift too.
  The served schema lists exactly the two endpoints. Pre-commit's `check-yaml` passes on the
  file.
- Left (frontend, on `dev-frontend`): add `openapi-typescript`, generate
  `frontend/src/api/schema.d.ts` from `backend/openapi.yaml`, and fail CI when it's stale.
  Also add `backend/openapi.yaml` to the frontend's change filter in `ci.yml`, so a schema
  change runs the frontend job.
- 2026-10-12: frontend half done, on `dev-frontend`.
  - `npm run gen:api` runs `openapi-typescript` on `backend/openapi.yaml` and writes
    `frontend/src/api/schema.ts`: path and component types, named root types (`Plan`, `Route`,
    `Checkpoint`, …) and a values array for every enum (`riskLevelEnumValues`, …), so UI lists
    such as the legend come from the contract.
  - The generated file is excluded from eslint and prettier.
  - **CI:** the frontend job runs `npm run gen:api:check`, which regenerates the file and fails
    if it is untracked or differs from the committed one. `ci.yml` runs the frontend job when
    `backend/openapi.yaml` changes, so a backend contract change can't skip the check.
- Decisions:
  - The output is `schema.ts`, not `schema.d.ts`: enum value arrays are runtime constants, and
    a declaration file can't provide values at runtime.
  - `openapi-typescript` 7.13 (latest) declares a TypeScript 5 peer. The project is on
    TypeScript 6, so `package.json` has an `overrides` entry for that one package rather than
    installing everything with `--legacy-peer-deps`. Its output type-checks under the project's
    strict config.
- Verified: the check fails when the file is untracked, and when the schema changes (a
  renamed enum value) without regenerating; it passes once regenerated and committed.

### SPOT-45 · Security settings, throttling, health checks

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | Done | SPOT-41 |

Spec: RFC §12, §18.3.

**Sub-tasks**
- [x] DRF throttles: plans 10/min per guest, 30/min per user; heatmap 20/min; geocode 60/min.
- [x] Secure, httpOnly, `SameSite=Lax` session and CSRF cookies; `CSRF_TRUSTED_ORIGINS`;
  `ALLOWED_HOSTS`, HTTPS redirect, HSTS, security middleware. No CORS (one origin).
- [x] `/healthz` and `/readyz` (Redis ping, settings check).

**Acceptance criteria**
- 11th plan request in a minute gets 429 `rate_limited`.
- `/readyz` returns 503 when Redis is down.
- `manage.py check --deploy` passes with prod settings.

**Progress log**
- 2026-10-12: throttling, cookie and HTTPS settings, and health endpoints.
  - **Throttles** (`planner/api/throttles.py`, rates in settings): plans 10/min for guests
    (`PlanGuestThrottle`) and 30/min per account (`PlanUserThrottle`), and geocode 60/min
    (`ScopedRateThrottle`). The `heatmap` rate (20/min) is defined for SPOT-42's endpoint.
    Counters live in the default cache. A 429 uses the error shape with `rate_limited` and
    `Retry-After`.
  - **Client IP:** `NUM_PROXIES` (env, default 0) says how many proxies' `X-Forwarded-For`
    entries to trust. DRF's default trusts the whole header, which would let a client pick its
    own throttle key.
  - **Cookies (all environments):** the session cookie is httpOnly and `SameSite=Lax`. The
    CSRF cookie is Lax but readable by JavaScript, since the client copies it into
    `X-CSRFToken` (RFC §7.5), and Django's docs say an httpOnly CSRF cookie adds nothing.
    `nosniff`, `Referrer-Policy: same-origin` and `X-Frame-Options: DENY` are set. No CORS:
    one origin.
  - **Production:** trusts `X-Forwarded-Proto`, redirects HTTP to HTTPS (except
    `/healthz` and `/readyz`), uses Secure session and CSRF cookies, and sends HSTS for a
    year (`SECURE_HSTS_SECONDS`).
  - **Health:** `config/health.py`. `/healthz` checks nothing beyond the process.
    `/readyz` pings Redis (with `IGNORE_EXCEPTIONS`, `cache.get` would hide an outage), runs
    `SELECT 1`, and checks that the provider settings build. It returns 200, or 503 naming the
    failed check without details (those go to the log). `/api/v1/healthz` stays for the
    frontend placeholder.
- Decisions (RFC §12 updated):
  - **HSTS** leaves out `includeSubDomains` and preload: the app runs on a host's domain, not
    one we own. Deploy-check warnings W005 and W021 are silenced for that reason.
  - **Guests** are counted by IP until guest sessions exist (SPOT-112).
  - The task's "httpOnly CSRF cookie" conflicts with the RFC's CSRF flow; the RFC wins.
- Verified (25 tests):
  - The 11th guest plan in a minute gets 429 `rate_limited` with `Retry-After`. Guests are
    counted per IP, and a changing `X-Forwarded-For` doesn't reset the count.
  - A signed-in user gets 30, then 429. The 61st suggestion gets 429. Plan and geocode limits
    are separate.
  - `/readyz` is 503 with `cache: fail` when Redis is unreachable (port 1), 503 when the
    database check fails or `PROVIDERS=real` has no key, and leaks no setting names. Both
    health endpoints are GET only and skip the HTTPS redirect.
  - `manage.py check --deploy --fail-level WARNING` passes with prod settings and a proper
    key ("no issues (2 silenced)"). A subprocess confirms prod's redirect, Secure cookies,
    HSTS and proxy header.
- Left: point the host's health checks at `/healthz` and `/readyz` and set `NUM_PROXIES` for
  its proxy chain (SPOT-100/101).
- 2026-10-12: Done; lands with the API PR into `dev-backend`.

### SPOT-46 · Structured logging and request ids

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | Done | SPOT-40 |

**Sub-tasks**
- [x] JSON logs; request id middleware; `X-Request-ID` response header.
- [x] One summary line per plan: provider latencies, cache hit ratio, checkpoint and grid
  counts, stale flag.

**Acceptance criteria**
- A plan's log lines (including provider calls) can be found by request id.

**Progress log**
- 2026-10-12: `config/observability.py` and logging settings.
  - **Request ids:** `RequestIdMiddleware` (first in the stack) keeps an incoming
    `X-Request-ID` if it looks like an id (8–64 of `[A-Za-z0-9._-]`), otherwise makes a uuid4,
    and echoes it in the response header. It sits in a context variable for the request, and
    the middleware logs one access line (method, path, status, duration).
  - **JSON logs:** `RequestIdFilter` stamps the id on every record, and `JsonFormatter`
    writes one object per line with time, level, logger, message, request id, any
    `extra={...}` fields and the traceback. `LOG_FORMAT=plain` (the local default) gives
    readable lines with the id in brackets. `LOG_LEVEL` sets the level.
  - **Provider calls:** `HttpClient.get_json` logs one line per call (provider, outcome,
    attempts, duration, status, error) and never the URL. Open-Meteo's worker threads run in
    a copy of the caller's context, so their lines carry the request id.
  - **Summaries:** `plan_trip` logs one line per plan: routes, checkpoints, forecast points,
    cache hit ratio, routing/weather/total ms, stale, recommendation, reason, warnings, via
    fallback, HOS, interval, demo. `corridor_grid` logs its own line with the grid point
    count, cell size, hit ratio, weather ms and stale. The grid is a separate request (RFC
    §7.3), so its count is on that line rather than the plan's. `ForecastLookup` now reports
    `cache_hits`.
- **Fixed in passing:** httpx logs every request URL at INFO, query string included, and
  HERE's API key is in the query string. With the root logger at INFO, the key would have
  reached the production logs. The `httpx` and `httpcore` loggers are now at WARNING, and a
  test guards it.
- Verified (13 tests in `tests/test_observability.py`):
  - **End to end:** a Dallas → Denver plan in real-weather mode (Open-Meteo mocked with respx,
    about 250 points in three parallel batches). Every provider call, from every worker
    thread, the plan summary and the access line carry the response's `X-Request-ID`, and no
    planner line is missing it.
  - A second identical plan logs a cache hit ratio of 1.0 (the first, 0.0).
  - Incoming ids are kept; empty, short, spaced, overlong or newline-containing ones are
    replaced. Ids are unique per request, and the context resets afterwards.
  - A failed provider call logs WARNING with status 503, 2 attempts and no query string.
  - JSON lines carry extras and tracebacks.
- 2026-10-12: Done; lands with the API PR into `dev-backend`.

---

## E5 Frontend base

### SPOT-50 · App shell, theme and design tokens

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | Done | SPOT-4, SPOT-10 |

**Sub-tasks**
- [x] Two-pane layout and header from the agreed design.
- [x] Tokens: risk palette, accent, spacing, type; light and dark themes.
- [x] `lib/risk.ts`: level → colour, label, score (single source for map and UI).
- [x] Replace the placeholder page; drop its `/api/v1/healthz` call and that route, and the
  task ids in its comments (carried over from the no-ids rule). _(frontend done; the backend
  route goes in the next backend change, see Open items)_
- [x] Export the AI Studio project for reference, if it helps (left over from SPOT-4).
  _(not needed: design-review.md carried what the shell needed)_

**Acceptance criteria**
- Theme toggle switches every surface including map overlays.
- Risk colours come only from `lib/risk.ts` (no hex codes elsewhere).

**Progress log**
- 2026-10-12: app shell, tokens and themes.
  - **Layout** (`features/shell`): header, a scrollable 400 px planner panel beside a
    full-height map region, and the timeline bar, as the design review keeps them. Each has a
    landmark with a name (banner, "Trip planner", main, "Forecast timeline"). On narrow
    screens the map stacks above the panel.
  - The placeholder page and its `/api/v1/healthz` call are gone; the panel shows the empty
    state's explainer until the trip form lands.
  - **Tokens** (`index.css`, Tailwind 4 `@theme`): semantic colours (`canvas`, `surface`,
    `surface-raised`, `line`, `ink`, `muted`, `accent`, `focus`, `danger`) with light and dark
    values, system font stacks, a mono stack, `.tabular` numbers, card radius, overlay shadow,
    a visible focus ring, and reduced motion honoured.
  - **Themes** (`lib/theme.ts`): a light/dark/system preference via `useSyncExternalStore`.
    The OS setting is followed live until the user picks one, which is stored in
    localStorage (and still applies if storage is blocked). An inline script in `index.html`
    applies the theme before first paint, so there is no flash. `ThemeToggle` sits in the
    header with an accessible name ("Switch to dark theme").
  - **Risk** (`lib/risk.ts`): label, score (0–4, null for Unknown), fill and ink colour per
    level, keyed by the generated `RiskLevelEnum`, so a new API level fails the type-check.
    `riskStyle(null)` is Unknown, never Low. The colours reach CSS as `--risk-*` variables set
    from this file at startup, so stylesheets and future map layers share one source.
- Decisions:
  - The palette is sequential, as RFC §10.6 asks: `#fed976`, `#fd8d3c`, `#e31a1c` and
    `#800026` from ColorBrewer's colour-blind-safe YlOrRd, then near-black for No travel.
    Unknown is a neutral grey outside the scale.
  - No web font: system stacks avoid a font request and layout shift.
  - The AI Studio export wasn't needed; the design review carried the layout.
- Verified (16 tests):
  - Every API level has a style, in order, with distinct colours; null and undefined are
    Unknown; the CSS variables are applied.
  - The theme follows the system, stores an explicit choice, forgets it on "system", ignores
    system changes once chosen, and survives blocked storage.
  - The shell has all four landmarks, icon controls have names, and the toggle switches
    `<html data-theme>`, which every surface keys on.
  - A palette guard fails if a risk colour, or any hex colour in a `.ts`/`.tsx` file, appears
    outside `lib/risk.ts`; checked by planting one.
  - Checked in Chrome: dark on first paint with a dark OS setting, light after toggling, no
    console errors. Production build is 47.6 KB of JS gzipped.
- Left: removing the backend's `/api/v1/healthz` route goes with the next backend change.

### SPOT-51 · API client, query layer and UI state

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | In progress | SPOT-44 |

**Sub-tasks**
- [x] Typed fetch client on generated types; error shape parsed into a typed error.
- [ ] TanStack Query: plan mutation, dependent heatmap query (routing and session are SPOT-120).
- [x] UI store (selected route, hovered/selected checkpoint, layer toggles); slider hour in
  its own context.

**Acceptance criteria**
- Heatmap request starts only after the plan resolves; routes render before it finishes.
- Changing the slider hour doesn't re-render the routes panel (checked with React Profiler).

**Progress log**
- 2026-10-12: API client, query layer and UI stores; the heatmap query waits for its endpoint.
  - **Client** (`api/client.ts`): `openapi-fetch` typed by the generated `paths`, with
    same-origin credentials. A middleware sends `X-CSRFToken` from Django's `csrftoken` cookie
    on unsafe methods. `fetch` is looked up per request, so wrappers (test servers,
    monitoring) see every call.
  - **Errors** (`api/errors.ts`): `unwrap()` turns every failure into one `ApiError` with
    `code`, `message`, `status`, `fields` (dotted names), `requestId` (`X-Request-ID`),
    `retryAfterS` and `transient`. A non-JSON proxy page is `server_error` with its status, a
    rejected fetch is `network_error`, and an abort is rethrown untouched (checked by name, as
    it can come from another realm's `DOMException`).
  - **Queries** (`api/queryClient.ts`): retry once, and only transient failures (network,
    502, 503), never 4xx, 422 or 429; no refetch on focus.
  - **Plans** (`api/plans.ts`):
    - `usePlanTrip().plan(request)` is a mutation with one `Idempotency-Key` per submission,
      reused by its automatic retry.
    - On success it writes the plan to `['plan', 'current']` (becomes `['trips', id]` once
      plans are saved) and selects the recommended route.
    - `usePlan(select)` reads the cache with `skipToken`, so each component subscribes only to
      its slice; TanStack's structural sharing keeps unchanged slices referentially equal.
  - **Places** (`api/places.ts`): `usePlaceSuggestions(q)` normalises like the backend, skips
    queries under 2 characters, caches for 24 h, cancels superseded requests and keeps the last
    results while loading. Debouncing is the form's job (SPOT-60).
  - **UI state** (`state/ui.ts`, Zustand): selected/hovered route and checkpoint plus layer
    toggles. Selecting a checkpoint selects its route; a new plan resets pointers and keeps
    layer choices.
  - **Timeline** (`state/timeline.ts`): a separate store for the hour (0–48, clamped,
    whole) and play state. The map layer can subscribe outside React and only set a paint
    property (RFC §10.4).
  - Providers with a per-test query client. TanStack Query devtools are dev-only and lazy,
    absent from the production build. `@tanstack/eslint-plugin-query` is enabled.
  - To exercise all this before the trip form exists, the empty state has "Plan the demo
    trip: Dallas → Denver", with the design's "Evaluating weather corridors…" pending label
    and an error panel (message, request id, Try again). There is also a "Demo data" header
    badge, a placeholder routes list (name, label, recommended, worst level, selection) and a
    minimal hour slider. Route cards (SPOT-62) and the timeline (SPOT-81) replace the
    placeholders.
- Decisions:
  - Zustand for UI state, with two stores rather than a context: selector subscriptions
    isolate re-renders, and the map can subscribe without React. RFC §10.2 allows it.
  - The plan is a mutation whose result goes into the query cache, rather than read from
    mutation state, so readers subscribe by slice and the same hooks serve saved trips later.
- Verified (45 tests, MSW at the network boundary, real fixture from the backend's demo plan
  typed `satisfies Plan`):
  - **Errors:** 400 with field messages and request id; 422/502 codes and transience; 429
    `Retry-After`; non-JSON 502; network failure; abort.
  - **CSRF** is sent on POST and not on GET.
  - **Idempotency:** one key per submission, reused on a 502 retry, new for the next
    submission. No retry on 400/422/429.
  - **Cache:** the plan lands in the cache and the recommended route is selected.
    Suggestions skip short queries, normalise, and hit the cache on repeat.
  - **Stores:** the clamps and resets behave.
  - **App flow:** routes, reason and badge; selection; an error with request id, then Try
    again recovers.
  - **Isolation** (React Profiler): seven hour changes commit the slider seven times and the
    routes panel zero times. A planted hour subscription in the panel fails the test.
    Selecting a route is one commit, and hovering a checkpoint is none.
  - **In Chrome against the real backend** (fake providers, via the Vite proxy): Route A
    recommended, "Fewest severe miles (0 vs 100)", demo badge, risk chips, no console errors.
  - The production bundle is 62.8 KB of JS gzipped (TanStack Query is most of the increase).
- Left: the dependent heatmap query, and its criterion "heatmap request starts only after the
  plan resolves". The endpoint doesn't exist until trips do (SPOT-42), and it isn't in the
  schema to type against.

---

## E6 Planning UI

### SPOT-60 · Trip form with autosuggest

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | Done | SPOT-51, SPOT-43 |

Spec: PRD §7.1.

**Sub-tasks**
- [x] Origin/destination comboboxes (250 ms debounce, keyboard navigation, swap button).
- [x] Departure picker in the origin's time zone; > 48 h note.
- [x] Load weight with thousands separators; interval segmented control.
- [x] zod schema mirroring server validation; server field errors shown inline.

**Acceptance criteria**
- Every server validation rule also fails client-side with the same message.
- Form is fully usable by keyboard.

**Progress log**
- 2026-10-12: trip form (`features/trip-form`).
  - **Form state:** React Hook Form with a Zod schema. Validation runs on submit, then on
    change.
  - **Rules** (`rules.ts`) mirror the API serializers rule for rule and word for word:
    required fields, pick a suggestion, places more than a mile apart, departure within 15 min
    ago to 7 days ahead, and load a whole number from 1 to 80,000. Errors the server still
    finds land on the same fields (`formFieldFor` maps `origin.lat` → origin and so on).
    Anything unmapped shows as a form-level alert.
  - **Origin and destination:** `PlaceCombobox`, an ARIA 1.2 combobox built on `downshift`:
    arrows, Enter, Escape, active descendant. Input is debounced 250 ms into
    `usePlaceSuggestions`. It shows "Searching…", "No matches" or "Place search is unavailable"
    in the list. Typing after picking clears the coordinates, so the label and position always
    agree. The origin shows its IANA zone, and a swap button exchanges the two.
  - **Departure:** a `datetime-local` input on the origin's clock (the browser's until an
    origin is picked), with the zone abbreviation (CDT). It defaults to the next whole hour,
    and adds a lower-confidence note beyond 48 h.
  - **Time zones:** `lib/time.ts` converts between that wall-clock time and UTC with Intl
    only. In the spring gap it reads forward; in the autumn overlap it takes the first
    occurrence.
  - **Load and interval:** load accepts separators and reformats to `42,000` on blur, with
    the 30,000/40,000 lb hint from the design. The interval is a segmented radio group.
  - **Submit** shows "Evaluating weather corridors…" while pending. On success the form
    collapses to a one-line summary ("Dallas, TX → Denver, CO · Mon 06:00 CDT · 42,000 lb ·
    every 25 mi") with Edit trip.
  - "Use the demo trip" fills Dallas → Denver, 42,000 lb, next hour; it replaces the
    temporary demo button.
- Decisions:
  - Places are stored as `{text, place}`, so the form can tell "nothing typed" (the API's
    "This field is required.") from "typed but not picked" ("Choose a place from the
    suggestions.", client-only because the API never sees text without coordinates).
  - No date library: Intl covers zone conversion, and 18 tests pin it down.
- Found in Chrome and fixed: typed text now reaches the form in the input's own `onChange`.
  Through downshift's `onInputValueChange`, which runs after render, React reset the
  controlled input between keystrokes, so fast typing dropped characters ("dal" became "l").
  A regression test fires key events faster than effects can run.
- Verified (39 new tests, 91 total):
  - Every rule fails with the API's message (11 cases). Valid edges pass (1, 80,000,
    `42 000`, 15 min ago).
  - The departure is read on the origin's clock (Denver 06:00 → 12:00Z, Dallas → 11:00Z).
  - Zone conversion: six zones including half-hour Kolkata, both DST transitions, and every
    hour of 2026 round-tripping in five zones including Lord Howe's 30-minute DST.
  - The form, through user events and MSW: a keyboard-only plan sends exactly the expected
    body; empty submit shows three "This field is required." messages and sends nothing.
    Typed-not-picked, typing after picking, no matches, search down, swap, the 48 h note,
    server field errors placed inline, collapse and Edit, and a non-field error with retry
    are all covered.

### SPOT-61 · Hours of Service fields

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P1 | Done | SPOT-60 |

Spec: PRD §7.3.1.

**Sub-tasks**
- [x] Toggle (off by default) revealing cycle select and four ELD-style clocks (`hh:mm`).
- [x] Cross-field validation (Drive ≤ Shift, Drive ≤ Cycle); cycle max follows the cycle type.
- [x] "How is this calculated?" popover listing rules and simplifications.

**Acceptance criteria**
- With the toggle off, no HOS fields are sent (`{"enabled": false}`).
- Switching to 60 h / 7 days clamps a 70 h cycle value with a visible message.

**Progress log**
- 2026-10-12: Hours of Service fields (`features/trip-form/HosFields.tsx`, `hos.ts`).
  - **Toggle:** a `role="switch"` toggle, off by default. With it off the clocks are hidden and
    the request carries only `hos: {enabled: false}`.
  - **Fields:** a cycle select (70 h / 8 days, 60 h / 7 days) and the four ELD clocks as
    `hh:mm` (drive, shift, until break, cycle), each with its maximum ("of 11:00"). Defaults
    are a rested driver.
  - **Rules** mirror the API's HOS serializer and its messages: each clock ≤ its limit, the
    cycle limit following the cycle, drive ≤ min(shift, cycle), and required when on. A
    malformed clock gets "Enter hours and minutes, like 10:30." (client-only, since the API
    takes decimal hours).
  - **Request:** clocks are sent as decimal-hour strings with two decimals ("10.33"), the
    API's `DecimalField` format, so no float rounding on the wire.
  - **Cycle switch:** switching to 60 h / 7 days caps a cycle value over 60:00 and says so
    in a status message ("Cycle time capped at 60:00, …"). A value that fits is left alone.
  - **"How is this calculated?"** is a disclosure listing the rules and the four
    simplifications from the PRD.
  - Server errors on `hos.*` land on their clock. The collapsed summary says "HOS on".
- Decision: `hh:mm` becomes hours with two decimals, so a clock can be up to 18 s off (10:20 →
  10.33 h → 10 h 19 m 48 s). That's within any ELD reading's precision, and the API takes only
  two decimals.
- Verified (31 new tests, 122 total):
  - Clock parsing and formatting (valid and invalid forms), and the hour conversion.
  - Every HOS rule with the API's message (9 cases); nothing is checked with HOS off.
  - The request block and the error routing.
  - Through the form: off sends `{enabled: false}` with the clocks hidden; on sends all four
    in hours. Drive over shift blocks submit and marks the drive clock invalid. The 60 h
    switch caps 70:00 with a visible status but leaves 52:30. A server `hos.until_break_h`
    error lands on its clock, and the explainer opens.

### SPOT-62 · Route cards and recommendation

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | Done | SPOT-51 |

**Sub-tasks**
- [x] Ranked cards: badge and reason, distance, drive time, arrival with zone, average risk,
  worst level pill, stacked miles-by-level bar with tooltips.
- [x] Not drivable tag; no-safe-route alert; warnings banner; stale forecast banner.
- [x] HOS summary and expandable stop list when HOS is on.
- [x] Card ↔ map selection and hover sync.

**Acceptance criteria**
- Every number on a card matches the API response (component tests on the demo fixture).
- Selecting a card selects the route on the map and vice versa.

**Progress log**
- 2026-10-12: route cards (`features/routes-panel`), replacing the placeholder list.
  - **Cards** are in rank order. Each shows "Route A · via Amarillo", the Recommended or Not
    drivable badges, and the reason on the recommended card. Its stats are distance, drive
    time, arrival in the destination's zone ("Mon 23:53 MDT"), average risk "x / 4.0" ("No
    data" when all Unknown), and the worst level as a coloured pill with its mile.
  - **Risk strip** (design review fix 2): each checkpoint's owned miles, in order along the
    route, in its level's colour, with a hover title per stretch. A text line and the
    accessible name give the miles by level ("655 mi Low · 75 mi Moderate · …").
  - **HOS on:** "Trip 22 h 14 min (incl. 1 break, 1 rest)" opens to the stops with kind,
    length in its natural unit ("Rest 10 h", "Break 30 min", design review fix 6), mile, start
    time on the origin's clock and the rule that caused it. The panel says "ETAs include Hours
    of Service stops."
  - **Plan notices:**
    - "No safe route right now" (an alert) when nothing is recommended.
    - A stale-forecast status with the forecast's age.
    - Warnings, naming their route.
  - **Sync:** cards read and write selection and hover through the UI store (click, hover,
    keyboard focus), so the map will need no extra wiring. Each card is memoised and subscribes
    only to its own selected and hovered state.
  - `lib/format.ts` is the single place for miles, durations, stop lengths, clock times with
    zone, average risk, forecast age and weather values. A missing value reads "No data",
    never blank or zero.
- Decisions:
  - The design's "stacked miles-by-level bar" became a positional strip with the totals as
    text: it shows where the risk is as well as how much, and the design review asked for
    per-span colour.
  - Arrival is on the destination's clock and HOS stops on the origin's, each with its zone
    abbreviation, so mixed zones are never ambiguous.
- Verified (23 new tests, 145 total), using two real backend fixtures: the demo plan, and a
  strong storm with HOS on (Route B not drivable, a break and a rest per route).
  - **Numbers:** every distance, drive time, arrival, average risk and worst level on every
    card equals the fixture's value through the formatters. "742 mi", "11 h 44 min" and
    "0.00 / 4.0" are also checked literally.
  - **Ordering:** cards follow rank, with one Recommended badge.
  - **Strip:** one segment per checkpoint, widths summing to 100%, and an accessible
    summary.
  - **States:** Not drivable only on Route B; HOS summary and stops with "Rest 10 h" and
    never "600 min"; the no-safe-route alert; stale age and route-named warnings.
  - **Sync:** card click → store, store → card (as the map will), hover set and cleared.
  - Formatters: 13 cases.
- Left: the map side of "selecting a card selects the route on the map and vice versa" is
  SPOT-71's, which now has a sub-task to use the same store.

### SPOT-63 · Checkpoint table

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | Done | SPOT-62 |

**Sub-tasks**
- [x] Table for the selected route: mile, ETA, gust, rain, snow, level.
- [x] Row click flies the map to the checkpoint and opens its popup.

**Acceptance criteria**
- Long routes (200+ rows) scroll smoothly (virtualised if needed).

**Progress log**
- 2026-10-12: checkpoint table (`features/checkpoints/CheckpointTable.tsx`), below the cards.
  - **Content:** the selected route's checkpoints with mile, ETA on the origin's clock
    ("Mon 07:04 CDT"), wind as sustained / gust in mph (sustained for information, design
    review fix 10), rain and snow per hour, and the level chip with the condition that set
    it ("Severe gusts"). A "· load" mark explains a level raised by the load rule.
  - **Missing data:** a missing forecast reads "No data" in every column and Unknown in grey,
    never Low or blank.
  - **Selection:** a row click, or Enter/Space on a focused row, sets `selectedCheckpoint` in
    the UI store (and `aria-selected`). Hover sets `hoveredCheckpoint`. The map will follow
    both.
  - **Virtualisation:** `@tanstack/react-virtual` with fixed 36 px rows in a 360 px viewport.
    Spacer rows above and below the rendered window keep it a native `<table>`, and
    `aria-rowcount` / `aria-rowindex` tell assistive technology where each row sits.
- Decisions:
  - It's always virtualised rather than above a threshold: one code path, and at 10 mi
    spacing a cross-country route has 300+ rows.
  - It sits below the cards, not inside the selected card, so the cards stay comparable at a
    glance.
- Found in Chrome and fixed: at the panel's 400 px the table needed sideways scrolling. The
  zone moved into the ETA heading (a row shows its own zone only where it differs, such as
  across a DST change), and the deciding condition sits under the level chip. Both tested.
- Verified (7 tests, 152 total):
  - Nothing renders until a route is selected. Row cells equal the fixture's values
    (mile, ETA, sustained / gust, rain, snow, level and driver), and the table follows the
    selection.
  - A null forecast gives "No data" ×3 and Unknown. The load-rule mark shows.
  - Click and Enter select, moving `aria-selected`.
  - A 300-checkpoint route renders fewer than 40 rows with `aria-rowcount` 301. After
    scrolling to row 200, row 200 is rendered and row 1 isn't.
  - jsdom does no layout, so `test/layout.ts` gives scroll containers their inline height in
    these tests. Real scrolling is checked in Chrome with the batch.
- Left: flying the map to the selected checkpoint is SPOT-72's, which now has a sub-task to
  follow the same store.

### SPOT-64 · Empty, loading, partial and error states

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | Done | SPOT-62 |

Spec: PRD §9, RFC §11.

**Sub-tasks**
- [x] Empty state with explainer; skeletons for routes; heatmap fade-in. _(fade-in moved to
  SPOT-80, with the layer it fades)_
- [x] Partial results (< 3 routes, Unknown checkpoints), not drivable, no safe route.
- [x] Error state per error code with retry; 429 message.

**Acceptance criteria**
- Each state reachable through the fake providers and covered by a component test.
- No state shows missing data as Low or as blank.

**Progress log**
- 2026-10-12: planner states (`features/plan/ResultsArea.tsx`).
  - **Results area:** below the form, driven by `useLatestPlanAttempt()` (TanStack's
    `useMutationState` on the plan mutation key), so it reflects any plan request without
    being wired to the form.
  - **Empty:** the explainer, until the first request.
  - **Loading:** three skeleton cards with an `aria-busy` region and one status line
    ("Evaluating weather along each route…"). The form's button reads "Evaluating weather
    corridors…" and is disabled for any pending request, including a retry.
  - **Errors** (`failureCopy.ts`, `PlanFailure.tsx`): a title and guidance per code, naming
    the service (HERE for routing, Open-Meteo for weather, never "NOAA", design review fix
    5), plus Try again. The request id is offered only when the server sent one. A rate limit
    holds the retry for `Retry-After` seconds with a countdown. Field errors stay on the form.
  - **Failure after an earlier plan:** the earlier plan stays visible, dimmed and labelled
    "Showing your previous plan, not the trip that just failed." (design review fix 5).
  - **Partial, not drivable, no safe route:** covered by the route cards' notices and the
    Unknown handling in cards and table. The routes list now has an accessible name ("Ranked
    routes"), separating it from the warnings list.
- Decisions:
  - "Each state reachable through the fake providers": not drivable comes from the strong
    storm fixture. Fewer than three routes, all-Unknown data and no safe route can't be
    produced by the fakes, so those tests adjust the real demo response.
  - Heatmap fade-in waits for the heatmap layer (SPOT-80), which has no data source until the
    heatmap endpoint exists.
- Verified (16 tests through the whole app with MSW, 168 total):
  - Empty, then loading (skeleton, disabled button) and results. Four error codes each show
    their title, request id and an enabled retry; routing names HERE and weather names
    Open-Meteo. A network failure, the 429 countdown (disabled then enabled), and a field
    error staying on the form are covered.
  - A failure after a plan keeps it dimmed and labelled. Two-route partial results show the
    warning. All-Unknown shows "No data" and Unknown with no Low anywhere. Not drivable and
    no safe route are covered, and no request id is mentioned without one.
  - **In Chrome** against the backend's fake providers: a keyboard-picked Dallas → Denver
    with HOS on gave three cards with HOS summaries and the Severe stretches on B and C.
    Route B's table scrolled to the storm ("Severe · gusts · load" at 41 mph). Stopping the
    backend gave the failure card above the dimmed previous plan.
- Left: heatmap fade-in, now a SPOT-80 sub-task.

---

## E7 Map

### SPOT-70 · Map view, basemap and camera

| Effort | Priority | Done | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-50 |

**Sub-tasks**
- [x] `react-map-gl/maplibre` with OpenFreeMap positron (and a dark style for dark mode).
- [x] Fit to routes with padding for the left panel; origin/destination pins.

**Acceptance criteria**
- Map loads without any token; camera fits all routes after each plan.

**Progress log**
- 2026-10-12: map view (`features/map/MapView.tsx`).
  - **Library:** `react-map-gl/maplibre` 8.1 on MapLibre 6.11. The map is lazy-loaded
    (`React.lazy`), so MapLibre's ~285 KB gzipped chunk never delays the form; a pulsing
    placeholder fills the pane meanwhile.
  - **Basemap:** OpenFreeMap `positron` (light) and `dark`, picked from the theme. Both are
    public, keyless styles.
  - **Camera:** fits `corridor.bbox` each time a plan arrives (keyed on `generated_at`, so
    hovering, theme changes or re-renders never refit). Padding scales down on small maps so
    the fit can't fail. The top clears the destination pin. Fits jump instead of fly under
    `prefers-reduced-motion`.
  - **Pins:** origin (ring) and destination (pin), each with an accessible name ("Origin:
    Dallas, TX").
  - **No WebGL:** a map that can't start is replaced by a status message pointing to the
    panel. A later error (a failed tile) leaves the map up.
- Decisions:
  - "Padding for the left panel": the panel sits beside the map rather than over it, so
    equal padding is enough.
  - MapLibre 6 looks for its worker beside its own module, which Vite's bundling moves. The
    worker is now built by Vite (`?worker&url`, ES format) and passed as `workerUrl`, which
    works in dev and in the build.
  - Tests use a stand-in for `react-map-gl/maplibre` (`test/fakeMap.ts`), installed for every
    test, because jsdom has no WebGL. It records sources, `setData` calls, layer props and
    camera calls.
- Verified (10 tests, 178 total):
  - Light and dark basemaps; a hint before planning.
  - One fit per plan with the corridor bbox and padding, a refit for a new plan and none
    otherwise, and a jump under reduced motion.
  - Pin positions, the no-WebGL fallback, and a tile error that keeps the map.
  - **In Chrome** against the fake providers: the US view loads with no key. The demo trip
    fits Dallas → Denver with both pins visible. The dark theme swaps the basemap with no
    console errors.

### SPOT-71 · Routes layer with risk-coloured segments

| Effort | Priority | Done | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-70 |

**Sub-tasks**
- [x] One GeoJSON source per plan (memoised); decode polylines once.
- [x] Unselected routes grey; selected route split into segments coloured by checkpoint risk,
  with casing.
- [x] Selection and hover via filters/paint expressions, not new data.
- [x] Read and write selection and hover through `state/ui.ts` (`selectedRouteId`,
  `hoveredRouteId`), the same store the route cards use, so card ↔ map sync needs no other
  wiring (carried over from SPOT-62).

**Acceptance criteria**
- Changing selection doesn't call `setData` (asserted in a test with a mocked map).

**Progress log**
- 2026-10-12: routes layer (`features/map/RoutesLayer.tsx`, `routeGeometry.ts`).
  - **Data:** `buildRouteGeometry(routes)` runs once per plan (memoised on `plan.routes`). It
    decodes each polyline once (`lib/polyline.ts`) and makes two sources:
    - `routes`: one line per route.
    - `route-segments`: every route split into stretches by checkpoint level. Each checkpoint
      colours the miles it owns (halfway to each neighbour, as the backend counts owned
      miles), and same-level neighbours merge. Distances along the polyline are scaled to the
      reported miles, as the backend does when it places checkpoints.
  - **Drawing:** other routes grey (4 px, darker and 5 px on hover). The selected route has a
    10 px casing (dark on the light basemap, light on the dark one) under 6 px segments
    coloured from `lib/risk.ts`, with Unknown in the neutral grey. A wide invisible hit line
    makes thin routes easy to point at.
  - **Selection and hover:** filters and paint expressions on `selectedRouteId` and
    `hoveredRouteId` in `state/ui.ts`. The map writes the same store as the route cards
    (`useMapPointer`), so card ↔ map sync needs no other wiring. The cursor turns to a pointer
    over a route.
- Decisions:
  - Every route is split into segments, not only the selected one, so selecting another
    route changes a filter rather than the data.
  - A replan that returns identical routes keeps the same `routes` object (query results are
    structurally shared), so its data isn't sent to the map again; the camera still refits.
  - Route greys and the casing are theme tokens (`--map-route`, `--map-route-hover`,
    `--map-casing` in `index.css`), read when the theme changes, because the map can't use
    CSS variables. The palette guard (no hex colours outside `lib/risk.ts`) holds.
  - `@types/geojson` added as a direct dev dependency instead of relying on MapLibre's.
- Verified (19 new tests, 197 total):
  - Polyline decoding against Google's reference example.
  - Stretch bounds and merging, and a route with no checkpoints drawn Unknown.
  - Each demo route covered end to end by unbroken segments in checkpoint-level order. Route
    B's Severe stretch passes within a mile of every Severe checkpoint.
  - **Acceptance:** selecting and hovering change filters and paint with no `setData` on
    either source (mocked map). New routes cause exactly one `setData` per source; identical
    routes cause none. A theme change swaps the line colours without new data.
  - Map hover, click and leave update the shared store, and the pointer cursor shows only
    over a route.
  - **In Chrome:** selecting Route B's card draws its storm between Salina and Wichita.
    Hovering Route C on the map brightens it and outlines its card; clicking it selects it,
    and the checkpoint table follows.

### SPOT-72 · Checkpoints layer, tooltip and popup

| Effort | Priority | Done | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-70 |

**Sub-tasks**
- [x] Single `circle` layer, colour by level, zoom-scaled radius; hover via `feature-state`.
- [x] Tooltip (level, ETA) and popup (mile, ETA, gust, sustained "for info", rain, snow,
  level, driver, load rule sentence).
- [x] Follow `selectedCheckpoint` / `hoveredCheckpoint` in `state/ui.ts`: fly to and open the
  popup for the selected checkpoint, highlight the hovered one. The checkpoint table already
  sets them (carried over from SPOT-63).

**Acceptance criteria**
- 600+ checkpoints pan and zoom at 60 fps.
- Popup text for a load-rule checkpoint reads e.g. "Raised High → Severe: gust 38 mph with a
  42,000 lb load (> 40,000 lb rule)".

**Progress log**
- 2026-10-12: checkpoints layer, tooltip and popup (`features/map/CheckpointsLayer.tsx`,
  `CheckpointPopups.tsx`).
  - **Layer:** one `checkpoints` source holding every route's checkpoints, built once per plan
    with numeric feature ids. One `circle` layer filtered to the selected route, coloured by
    level from `lib/risk.ts`, with radius scaled by zoom (3 → 8 px) and an outline from the
    casing token.
  - **Highlight:** `hoveredCheckpoint` and `selectedCheckpoint` from `state/ui.ts` become
    `feature-state` (`hover`, `selected`), drawn larger with a heavier outline. They are
    re-applied when a new basemap (theme change) re-adds the source.
  - **Tooltip:** the hovered checkpoint's level chip and ETA ("Mon 11:48 CDT"), from the map
    or from a table row.
  - **Popup:** the selected checkpoint's mile and route, ETA, gust, sustained "(for info)",
    rain, snow, and level with its driver. A load-rule checkpoint adds the sentence from
    `lib/loadRule.ts`, e.g. "Raised High → Severe: gust 37 mph with a 42,000 lb load
    (> 40,000 lb rule)". Closing it, or clicking empty map, clears the checkpoint and keeps
    the route. Popups use the app's surface tokens in both themes.
  - **Follows the table:** choosing a row opens its popup. If the checkpoint is off screen
    the map eases to it (a jump under reduced motion); otherwise the camera stays put.
  - **Pointer:** a checkpoint wins over the route beneath it. The hover changes only when the
    pointer moves to a different checkpoint, so moving within one doesn't re-run the
    highlight.
- Verified (18 new tests, 215 total):
  - Checkpoint ids are unique, and positions, route, index and level are kept (null as
    Unknown).
  - Route switching is a filter change with no `setData`.
  - Hover and selection feature-state is set and cleared, and re-applied only on the source's
    metadata event.
  - Tooltip text; popup fields and the load-rule sentence from the real fixture; one popup
    when a checkpoint is both hovered and selected; close button; easing only when off
    screen.
  - Map hover and click precedence; a steady hover; a click on empty map.
  - **In Chrome:** choosing Route B's mile-325 row opened its popup on the map. Mile 350 read
    "Raised High → Severe: gust 37 mph with a 42,000 lb load (> 40,000 lb rule)". Hovering
    another row showed its tooltip. In the dark theme, MapLibre's stylesheet (loaded later
    with the map) had overridden the popup colours, leaving light text on white. The
    overrides are now scoped under `.maplibregl-map`, and popups use the dark surface.
  - **Performance (acceptance):** a Los Angeles → New York plan every 10 mi gives 773
    checkpoints. With the route filter lifted in the console so all 773 rendered, 120
    pan/zoom steps took a median of 0.8 ms per synchronous redraw (p95 2.8 ms, max 8.7 ms),
    against 16.7 ms for 60 fps. Chrome was throttling the occluded test window to one
    frame a second, so this is MapLibre's render time per frame, not a frame-rate trace.
    SPOT-92's pan/zoom trace measures the frame rate in a visible window, with 773
    checkpoints among its cases.

### SPOT-73 · HOS stops layer

| Effort | Priority | Done | Depends on |
|---|---|---|---|
| Frontend · 1 | P1 | To do | SPOT-72, SPOT-24 |

**Sub-tasks**
- [x] Symbol layer with break, rest and restart icons; popup with start, duration, reason.

**Acceptance criteria**
- Shown only when HOS is on; stop positions match the API's coordinates.

**Progress log**
- 2026-10-12: HOS stops on the map (`features/map/HosStopsLayer.tsx`).
  - The selected route's stops, only when the plan has HOS on, at the API's `lat`/`lon`.
    Each stop is a round icon button: pause bars for a break, a moon for a rest, a circular
    arrow for a restart. The button's accessible name is "Break 30 min, Mon 13:00 CDT".
  - A click opens a popup with the stop's length, start and end (on the origin's clock, like
    the table), mile, and reason. It closes on its button or a second click, and with a
    change of route.
  - Stop names and reasons are shared with the route cards' HOS summary (`lib/hosStops.ts`),
    so the two always read the same.
- Decisions:
  - **Markers, not a symbol layer.** A route has a handful of stops, so DOM markers cost
    nothing. Each is a real button, reachable and openable from the keyboard, and no sprite
    images need adding to (and re-adding after a basemap change on) the map. RFC §10.3
    updated.
  - A stop click stops propagating, so the map doesn't read it as a click on empty map and
    close the checkpoint popup.
- Verified (5 tests, 220 total, on the real HOS fixture):
  - A marker per stop at the API's coordinates, with accessible names.
  - Nothing when HOS is off.
  - Popup start, end, length and reason; close.
  - A stop click leaves the checkpoint selection alone.
  - Switching routes moves the markers and closes the popup.
  - **In Chrome:** with HOS on, the demo trip showed a break near Raton and a rest near
    Colorado Springs on Route A. The rest's popup read "Rest 10 h, Starts Mon 18:30 CDT,
    Ends Tue 04:30 CDT, 702 mi in, 11 h driving limit".

### SPOT-74 · Legend and layer toggles

| Effort | Priority | Done | Depends on |
|---|---|---|---|
| Frontend · 1 | P0 | To do | SPOT-72 |

**Sub-tasks**
- [x] Collapsible legend (six levels with labels); toggles for heatmap, checkpoints, other
  routes.

**Acceptance criteria**
- Toggles change layer visibility only (no data reload).

**Progress log**
- 2026-10-12: legend and layer switches (`features/map/Legend.tsx`).
  - Collapsible legend at the map's bottom left, once a trip is planned. It has the six
    buckets (Low → No travel, then Unknown), each as a swatch with its label, so colour is
    never the only cue.
  - Switches for **Checkpoints** and **Other routes**, kept in `state/ui.ts` `layers` (they
    survive a new plan). Each changes `layout.visibility` only. Hiding the other routes also
    narrows the hover target to the selected route, so a hidden route can't be pointed at.
- Decisions:
  - No heatmap switch yet: there's no heatmap layer to switch until SPOT-80. Added there as a
    sub-task. The store already has the `heatmap` flag.
- Verified (5 tests, 225 total):
  - The legend appears only after planning, lists the six labels in order, and collapses.
  - The switches flip `visibility` with no `setData` on any source. Hiding other routes
    filters the hover target to the selected route.
  - **In Chrome:** switching both off left only Route A and its HOS stops. The legend and
    popups read correctly in both themes.

---

## E8 Heatmap

### SPOT-80 · Corridor heatmap layer

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-42, SPOT-70 |

Spec: RFC §10.4.

**Sub-tasks**
- [ ] Build GeoJSON with flat `h0`…`h48` properties once per heatmap response.
- [ ] `heatmap` layer under routes: weight from `h<hour>`, zoom-scaled radius, risk colour ramp.
- [ ] Visual check at zooms 4–10; switch to the fill-grid fallback if the blur misleads.
- [ ] Fade the heatmap in when it arrives, after the routes (carried over from SPOT-64).
- [ ] Add a Heatmap switch to the map legend (`features/map/Legend.tsx`, `layers.heatmap` in
  `state/ui.ts`) (carried over from SPOT-74).

**Acceptance criteria**
- Heatmap colours agree with checkpoint colours at the same place and hour (visual check on
  the demo scenario, recorded in the log).

**Progress log**
- _Not started._

### SPOT-81 · 48-hour slider and playback

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-80 |

**Sub-tasks**
- [ ] Native range input 0–48, 6 h ticks, label "+14 h · Sat 20:00 CDT", arrow keys.
- [ ] `setPaintProperty` on change, throttled with `requestAnimationFrame`.
- [ ] Play/pause at 250 ms per hour, looping; note when the window ends before departure.

**Acceptance criteria**
- Chrome performance trace while dragging: no long tasks > 50 ms, frames ≤ 16 ms, zero
  network requests.
- `aria-valuetext` reads "+14 hours, Saturday 20:00".

**Progress log**
- _Not started._

### SPOT-82 · Truck position while scrubbing

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P1 | To do | SPOT-81 |

**Sub-tasks**
- [ ] For each route, position at the slider time from checkpoint ETAs (and HOS stops).
- [ ] Hidden before departure and after arrival; stationary during HOS stops.

**Acceptance criteria**
- Truck marker sits on the checkpoint whose ETA equals the slider time.

**Progress log**
- _Not started._

### SPOT-83 · Heatmap metric switcher

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Full stack · 2 | P1 | To do | SPOT-81 |

**Sub-tasks**
- [ ] Backend: `?include=metrics` returns gust, rain and snow grids.
- [ ] Frontend: switch between composite risk, gust, rain, snow with matching legends.

**Acceptance criteria**
- Switching metric doesn't refetch once metrics are loaded.

**Progress log**
- _Not started._

---

## E9 Hardening

### SPOT-90 · End-to-end smoke test

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Full stack · 2 | P0 | To do | SPOT-81 |

**Sub-tasks**
- [ ] Playwright against the backend in fake mode: plan the demo trip, check 3 cards and the
  recommendation, open a checkpoint popup, scrub the slider.
- [ ] Second flow (once P1 accounts exist): plan as guest, sign up, see the trip in My trips,
  share it, open the link in a fresh browser context.
- [ ] Run in CI.

**Acceptance criteria**
- Smoke test passes in CI on every PR.

**Progress log**
- _Not started._

### SPOT-91 · Accessibility pass

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-64, SPOT-81 |

**Sub-tasks**
- [ ] axe check on every state; keyboard-only walkthrough; contrast in both themes.

**Acceptance criteria**
- No serious or critical axe violations; every task in the PRD stories can be done by keyboard.

**Progress log**
- _Not started._

### SPOT-92 · Performance check against budgets

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Full stack · 2 | P0 | To do | SPOT-100, SPOT-101 |

Spec: PRD §8.

**Sub-tasks**
- [ ] Measure cold and warm plan latency on the hosted app (1,500 mi trip, 10 mi interval).
- [ ] Chrome trace for pan/zoom and slider scrubbing; bundle size report. Include pan/zoom
  with all 773 checkpoints of a Los Angeles → New York plan every 10 mi showing (SPOT-72
  measured render time only, in a throttled window).
- [ ] Record numbers here; fix anything over budget.

**Acceptance criteria**
- p95 plan < 6 s cold, < 1.5 s warm; slider and map at 60 fps; numbers logged below.

**Progress log**
- _Not started._

---

## E10 Delivery

### SPOT-100 · Deploy backend and Redis

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| DevOps · 2 | P0 | To do | SPOT-45 |

**Sub-tasks**
- [ ] Dockerfile (gunicorn 3 workers × 4 threads, non-root user); Render or Fly.io service with
  managed Postgres and Redis; health checks on `/healthz` and `/readyz`.
- [ ] Migrations as a release step; daily scheduled job for `purge_trips`; run `seed_demo`.
- [ ] Always-on instance for the review window; secrets set in the host.
- [ ] Set `NUM_PROXIES` to the real proxy chain (Vercel rewrite plus the host's proxy) so
  throttles key on the client IP (carried over from SPOT-45).
- [ ] Run the forecast cache and `/readyz` against real Redis (carried over from SPOT-35;
  only tested on local memory, no Docker here).
- [ ] Run `make up` once with Docker to confirm the compose stack (left over from SPOT-10).

**Acceptance criteria**
- Hosted API answers the first request after 1 h idle in under 3 s.
- `manage.py check --deploy` clean.

**Progress log**
- _Not started._

### SPOT-101 · Deploy frontend

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| DevOps · 1 | P0 | To do | SPOT-100 |

**Sub-tasks**
- [ ] Vercel build; rewrite `/api/*` to the Django service (one origin, first-party cookies);
  SPA fallback routing.

**Acceptance criteria**
- Hosted URL plans a real trip from a clean browser profile, in Safari as well as Chrome
  (catches cookie problems).

**Progress log**
- _Not started._

### SPOT-102 · README

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Docs · 2 | P0 | To do | SPOT-101 |

**Sub-tasks**
- [ ] What it does, hosted link, screenshots/GIF, quick start (`make dev`), tests, architecture
  diagram, key decisions with links to PRD/RFC, known limitations, demo account credentials.
- [ ] Choose and add a licence (left over from SPOT-10).

**Acceptance criteria**
- A new developer runs the app locally from the README in under 10 minutes.

**Progress log**
- _Not started._

### SPOT-103 · Loom walkthrough

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Docs · 2 | P0 | To do | SPOT-102 |

**Sub-tasks**
- [ ] Script (PRD §13): demo trip where weather changes the recommendation, a load rule
  raising a rating, heatmap scrub, HOS toggle, then code tour of `domain/` and its tests.
- [ ] Record 5–10 minutes; link in README.

**Acceptance criteria**
- Video is 5–10 minutes and covers every point in the script.

**Progress log**
- _Not started._

---

## E11 Trips and accounts

Spec: PRD §7.9, RFC §3.1, §3.2, §7.4, §7.5. The P0 tasks here (saving trips, guest identity,
trip pages) ship with the core; the P1 tasks (accounts and trip management) come after the
core features, per PRD §5.

### SPOT-110 · Trip models, constraints, migrations and admin

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-14 |

**Sub-tasks**
- [ ] `Trip`, `TripRoute`, `TripHeatmap` as RFC §3.1, including `idempotency_key`.
- [ ] All check and unique constraints and the two owner indexes.
- [ ] Django admin: trip list (owner, route, created, saved, shared), routes inline read-only,
  search by place, filter by saved/guest.
- [ ] `makemigrations --check` in CI.

**Acceptance criteria**
- One `IntegrityError` test per constraint: no owner, two owners, guest saving, load 0 and
  80,001, interval 20, duplicate rank, two recommended routes, recommended but not drivable,
  arrival before departure.
- Migrations apply cleanly to an empty Postgres database.

**Progress log**
- _Not started._

### SPOT-111 · Save plans as trips

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-110, SPOT-40 |

**Sub-tasks**
- [ ] `repositories.py`: domain objects → models with versioned JSON serializers
  (`snapshot_version = 1`), and back.
- [ ] Save trip and routes in one `transaction.atomic()`.
- [ ] `Idempotency-Key` handling: same key returns the existing trip.
- [ ] Add `trip_id` to the plan response (carried over from SPOT-41) and regenerate
  `openapi.yaml`.

**Acceptance criteria**
- Save then load gives a response identical to the original plan response (round-trip test on
  the golden demo plan).
- A failure while saving routes leaves no trip row behind.
- Two requests with the same key create one trip.
- `domain/` still imports nothing from Django (import-lint check).

**Progress log**
- _Not started._

### SPOT-112 · Guest identity and access layer

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-110 |

**Sub-tasks**
- [ ] Sessions on the `cached_db` backend; guest cookie lasts 30 days.
- [ ] Create `guest_id` in the session on a guest's first plan.
- [ ] `planner/access.py`: `Owner`, `current_owner(request)`, `get_visible_trip()`,
  `get_owned_trip()`; 404 for anything not visible.
- [ ] Count the guest plan throttle by session `guest_id` as well as IP (carried over from
  SPOT-45, which counts by IP only).

**Acceptance criteria**
- Access-matrix tests (owner / other user / guest / other guest / anonymous × private /
  shared) pass for `get_visible_trip` and `get_owned_trip`.
- No view queries `Trip` directly (enforced by a test that greps views, or by code review
  checklist).

**Progress log**
- _Not started._

### SPOT-113 · Trip read endpoints

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-111, SPOT-112 |

**Sub-tasks**
- [ ] `GET /api/v1/trips` (summaries, cursor pagination, `saved` and `q` filters; guests capped
  at 20).
- [ ] `GET /api/v1/trips/{id}` (full snapshot + meta, `is_owner`).

**Acceptance criteria**
- Listing 20 trips runs in 2 queries (`django_assert_num_queries`).
- A guest can open their own trip; another guest gets 404; anyone can open a shared trip.

**Progress log**
- _Not started._

### SPOT-114 · Accounts (sign up, log in, log out, session)

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P1 | To do | SPOT-14, SPOT-112 |

**Sub-tasks**
- [ ] `django-allauth` headless (browser client), email login, verification off; mounted at
  `/api/auth/`.
- [ ] Argon2 hasher and Django password validators.
- [ ] `GET /api/v1/me`.
- [ ] Higher plan throttle for signed-in users.

**Acceptance criteria**
- Sign-up, login, session and logout work from the SPA with CSRF enforced (requests without
  the token are rejected).
- Email is case-insensitive: `A@x.com` and `a@x.com` can't both register.
- Repeated failed logins are rate limited.

**Progress log**
- _Not started._

### SPOT-115 · Move guest trips into the account on sign-in

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P1 | To do | SPOT-114 |

**Sub-tasks**
- [ ] `user_logged_in` handler: transfer trips for the session's `guest_id`, then drop it.

**Acceptance criteria**
- Guest plans 3 trips, signs up: all 3 are in the account and no guest trips remain.
- Same for logging in to an existing account.
- Logging out and planning again creates a new guest whose trips the account can't see.

**Progress log**
- _Not started._

### SPOT-116 · Trip actions API

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P1 | To do | SPOT-113, SPOT-114 |

**Sub-tasks**
- [ ] `PATCH /api/v1/trips/{id}`: name, saved (users only → else 403 `account_required`),
  shared.
- [ ] `DELETE /api/v1/trips/{id}`.
- [ ] `POST /api/v1/trips/{id}/replan`: new trip, same inputs, current weather, departure
  moved to now if past, `replanned_from` set, owned by the caller.

**Acceptance criteria**
- Access matrix passes for every action (non-owners get 404, including on shared trips for
  PATCH and DELETE).
- Turning sharing off makes the link 404 for others immediately.

**Progress log**
- _Not started._

### SPOT-117 · Delete account

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P1 | To do | SPOT-114 |

**Sub-tasks**
- [ ] `DELETE /api/v1/me` with password confirmation; cascade trips; end the session.

**Acceptance criteria**
- Wrong password → 400 and nothing deleted; right password → user, trips, routes and heatmaps
  gone, and the old session cookie no longer authenticates.

**Progress log**
- _Not started._

### SPOT-118 · Retention purge

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | To do | SPOT-110 |

**Sub-tasks**
- [ ] `manage.py purge_trips`: guest trips > 30 days, unsaved user trips > 90 days; then
  `clearsessions`. Logs counts.
- [ ] Scheduled daily on the host (wired up in SPOT-100).

**Acceptance criteria**
- Test with trips either side of each cut-off: exactly the expired ones are deleted; saved
  trips are never deleted.

**Progress log**
- _Not started._

### SPOT-119 · Demo account seed

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P1 | To do | SPOT-114, SPOT-30 |

**Sub-tasks**
- [ ] `manage.py seed_demo`: reviewer account plus 4 saved trips from the fake providers;
  idempotent.

**Acceptance criteria**
- Running it twice leaves one demo user with 4 trips.

**Progress log**
- _Not started._

### SPOT-120 · Routing and session handling

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-51 |

**Sub-tasks**
- [ ] react-router routes: `/`, `/trips/:id`, `/trips`, `/login`, `/signup`, `/account`;
  guard redirecting guests from `/trips` and `/account` to `/login?next=…`.
- [ ] `me` query; API client sends `X-CSRFToken` and an `Idempotency-Key` per plan submission.
- [ ] Vite dev proxy for `/api` (same origin as production).

**Acceptance criteria**
- Logging in or out refreshes the header and trip lists without a page reload.
- Double-clicking Plan creates one trip.

**Progress log**
- _Not started._

### SPOT-121 · Trip page

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-120, SPOT-113 |

**Sub-tasks**
- [ ] `/trips/:id` renders the planner view from the saved snapshot and stored heatmap; banner
  "Planned … · forecast as of then".
- [ ] After planning, the URL changes to the new trip's page.
- [ ] "Trip not found" page for 404s.

**Acceptance criteria**
- Reloading a trip page shows exactly the same routes, numbers and heatmap.

**Progress log**
- _Not started._

### SPOT-122 · Recent trips menu (guest)

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 1 | P0 | To do | SPOT-121 |

**Sub-tasks**
- [ ] Header dropdown with the last 20 trips and the "Sign up to keep these" prompt.

**Acceptance criteria**
- A new trip appears at the top immediately after planning.

**Progress log**
- _Not started._

### SPOT-123 · Log in and sign-up pages

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P1 | To do | SPOT-120, SPOT-114 |

**Sub-tasks**
- [ ] Forms with inline server errors and password hints; redirect to `next`.
- [ ] Toast after sign-in: "N trips from this device were added to your account."

**Acceptance criteria**
- Keyboard-only sign-up and login work; errors are announced to screen readers.

**Progress log**
- _Not started._

### SPOT-124 · My trips page

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P1 | To do | SPOT-123, SPOT-116 |

**Sub-tasks**
- [ ] List with saved star, name or route, departure, load, recommended route and worst level,
  planned date; All/Saved tabs; search; infinite scroll on the cursor.
- [ ] Row actions: open, rename, share, delete (confirm).

**Acceptance criteria**
- Works with 0, 1 and 200 trips; empty state links to the planner.

**Progress log**
- _Not started._

### SPOT-125 · Trip actions UI

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P1 | To do | SPOT-121, SPOT-116 |

Replaces the earlier "shareable URL" task: a real trip link is better than encoding inputs,
because it shows the result the user actually saw.

**Sub-tasks**
- [ ] On the trip page: Re-plan with current weather, Save (with name), Share (switch + copy
  link), Delete.
- [ ] Guests clicking Save get a "Create an account to save trips" dialog.
- [ ] Shared trip opened by someone else: read-only, only "Re-plan" available.

**Acceptance criteria**
- Each action updates the page and lists without a reload; share-off revokes the copied link.

**Progress log**
- _Not started._

### SPOT-126 · Account page

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 1 | P1 | To do | SPOT-123, SPOT-117 |

**Sub-tasks**
- [ ] Email, log out, delete-account danger zone with password confirmation.

**Acceptance criteria**
- After deletion the user lands on the planner as a guest with an empty recent-trips list.

**Progress log**
- _Not started._
