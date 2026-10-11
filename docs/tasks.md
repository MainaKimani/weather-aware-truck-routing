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
  finish. Branches and commits carry the task id, e.g. `feat(risk): apply load rules [SPOT-23]`.
- **Done means** every acceptance criterion is met, tests pass in CI, and the progress log says so.

## Board

| ID | Task | Epic | Effort | Pri | Status |
|---|---|---|---|---|---|
| SPOT-1 | Assess brief, write PRD | E0 Planning | Docs · 2 | P0 | Done |
| SPOT-2 | Write technical RFC | E0 Planning | Docs · 3 | P0 | Done |
| SPOT-3 | Write UI prototype prompts (Lovable, AI Studio) | E0 Planning | Docs · 1 | P0 | Done |
| SPOT-4 | Build UI prototype in AI Studio and review | E0 Planning | Frontend · 2 | P0 | In review |
| SPOT-10 | Monorepo scaffold and local dev | E1 Foundation | DevOps · 2 | P0 | In review |
| SPOT-11 | Quality gates (lint, types, pre-commit) | E1 Foundation | DevOps · 1 | P0 | Done |
| SPOT-12 | CI pipeline | E1 Foundation | DevOps · 2 | P0 | Done |
| SPOT-13 | Settings and configuration | E1 Foundation | Backend · 1 | P0 | In review |
| SPOT-14 | Postgres and custom user model | E1 Foundation | Backend · 1 | P0 | To do |
| SPOT-20 | Units and geo utilities | E2 Domain | Backend · 2 | P0 | To do |
| SPOT-21 | Checkpoint sampling and owned miles | E2 Domain | Backend · 2 | P0 | To do |
| SPOT-22 | ETA interpolation | E2 Domain | Backend · 2 | P0 | To do |
| SPOT-23 | Risk classification and load rules | E2 Domain | Backend · 3 | P0 | To do |
| SPOT-24 | Hours of Service planner | E2 Domain | Backend · 5 | P1 | To do |
| SPOT-25 | Route metrics | E2 Domain | Backend · 2 | P0 | To do |
| SPOT-26 | Ranking and recommendation reason | E2 Domain | Backend · 2 | P0 | To do |
| SPOT-30 | Provider protocols, fakes and demo scenarios | E3 Providers | Backend · 3 | P0 | To do |
| SPOT-31 | HERE truck routing adapter | E3 Providers | Backend · 3 | P0 | To do |
| SPOT-32 | Route alternatives: dedupe and via-point fallback | E3 Providers | Backend · 3 | P0 | To do |
| SPOT-33 | HERE autosuggest adapter | E3 Providers | Backend · 1 | P0 | To do |
| SPOT-34 | Open-Meteo forecast adapter | E3 Providers | Backend · 3 | P0 | To do |
| SPOT-35 | Forecast cache | E3 Providers | Backend · 3 | P0 | To do |
| SPOT-36 | Provider resilience | E3 Providers | Backend · 2 | P0 | To do |
| SPOT-40 | Plan service orchestration | E4 API | Backend · 3 | P0 | To do |
| SPOT-41 | `POST /api/v1/plans` endpoint | E4 API | Backend · 2 | P0 | To do |
| SPOT-42 | Corridor grid and heatmap endpoint | E4 API | Backend · 3 | P0 | To do |
| SPOT-43 | Geocode suggest endpoint | E4 API | Backend · 1 | P0 | To do |
| SPOT-44 | OpenAPI schema and TS type generation | E4 API | Full stack · 1 | P0 | To do |
| SPOT-45 | Security settings, throttling, health checks | E4 API | Backend · 2 | P0 | To do |
| SPOT-46 | Structured logging and request ids | E4 API | Backend · 1 | P0 | To do |
| SPOT-50 | App shell, theme and design tokens | E5 Frontend base | Frontend · 2 | P0 | To do |
| SPOT-51 | API client, query layer and UI state | E5 Frontend base | Frontend · 2 | P0 | To do |
| SPOT-60 | Trip form with autosuggest | E6 Planning UI | Frontend · 3 | P0 | To do |
| SPOT-61 | Hours of Service fields | E6 Planning UI | Frontend · 2 | P1 | To do |
| SPOT-62 | Route cards and recommendation | E6 Planning UI | Frontend · 3 | P0 | To do |
| SPOT-63 | Checkpoint table | E6 Planning UI | Frontend · 2 | P0 | To do |
| SPOT-64 | Empty, loading, partial and error states | E6 Planning UI | Frontend · 2 | P0 | To do |
| SPOT-70 | Map view, basemap and camera | E7 Map | Frontend · 2 | P0 | To do |
| SPOT-71 | Routes layer with risk-coloured segments | E7 Map | Frontend · 3 | P0 | To do |
| SPOT-72 | Checkpoints layer, tooltip and popup | E7 Map | Frontend · 3 | P0 | To do |
| SPOT-73 | HOS stops layer | E7 Map | Frontend · 1 | P1 | To do |
| SPOT-74 | Legend and layer toggles | E7 Map | Frontend · 1 | P0 | To do |
| SPOT-80 | Corridor heatmap layer | E8 Heatmap | Frontend · 3 | P0 | To do |
| SPOT-81 | 48-hour slider and playback | E8 Heatmap | Frontend · 3 | P0 | To do |
| SPOT-82 | Truck position while scrubbing | E8 Heatmap | Frontend · 2 | P1 | To do |
| SPOT-83 | Heatmap metric switcher | E8 Heatmap | Full stack · 2 | P1 | To do |
| SPOT-90 | End-to-end smoke test | E9 Hardening | Full stack · 2 | P0 | To do |
| SPOT-91 | Accessibility pass | E9 Hardening | Frontend · 2 | P0 | To do |
| SPOT-92 | Performance check against budgets | E9 Hardening | Full stack · 2 | P0 | To do |
| SPOT-100 | Deploy backend and Redis | E10 Delivery | DevOps · 2 | P0 | To do |
| SPOT-101 | Deploy frontend | E10 Delivery | DevOps · 1 | P0 | To do |
| SPOT-102 | README | E10 Delivery | Docs · 2 | P0 | To do |
| SPOT-103 | Loom walkthrough | E10 Delivery | Docs · 2 | P0 | To do |
| SPOT-110 | Trip models, constraints, migrations and admin | E11 Trips & accounts | Backend · 3 | P0 | To do |
| SPOT-111 | Save plans as trips | E11 Trips & accounts | Backend · 2 | P0 | To do |
| SPOT-112 | Guest identity and access layer | E11 Trips & accounts | Backend · 2 | P0 | To do |
| SPOT-113 | Trip read endpoints | E11 Trips & accounts | Backend · 2 | P0 | To do |
| SPOT-114 | Accounts (sign up, log in, log out, session) | E11 Trips & accounts | Backend · 3 | P1 | To do |
| SPOT-115 | Move guest trips into the account on sign-in | E11 Trips & accounts | Backend · 1 | P1 | To do |
| SPOT-116 | Trip actions API | E11 Trips & accounts | Backend · 2 | P1 | To do |
| SPOT-117 | Delete account | E11 Trips & accounts | Backend · 1 | P1 | To do |
| SPOT-118 | Retention purge | E11 Trips & accounts | Backend · 1 | P0 | To do |
| SPOT-119 | Demo account seed | E11 Trips & accounts | Backend · 1 | P1 | To do |
| SPOT-120 | Routing and session handling | E11 Trips & accounts | Frontend · 2 | P0 | To do |
| SPOT-121 | Trip page | E11 Trips & accounts | Frontend · 2 | P0 | To do |
| SPOT-122 | Recent trips menu (guest) | E11 Trips & accounts | Frontend · 1 | P0 | To do |
| SPOT-123 | Log in and sign-up pages | E11 Trips & accounts | Frontend · 2 | P1 | To do |
| SPOT-124 | My trips page | E11 Trips & accounts | Frontend · 3 | P1 | To do |
| SPOT-125 | Trip actions UI | E11 Trips & accounts | Frontend · 2 | P1 | To do |
| SPOT-126 | Account page | E11 Trips & accounts | Frontend · 1 | P1 | To do |

**Totals:** 70 tasks · P0 116 points, P1 28 points. Done: 3 (6 points).

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
| Frontend · 2 | P0 | In review | SPOT-3 |

**Sub-tasks**
- [x] Run `docs/ai-studio-prompt.md` in AI Studio (Build); fix weak areas with the prompts in
  `docs/ai-studio-followups.md`.
- [x] Review against PRD §7–§9: every screen and state present, palette and labels right,
  including guest vs signed-in header, login/sign-up, My trips and the trip page.
- [x] Decide what to keep: layout, components, tokens. Record changes to the PRD/RFC if the
  design changes a requirement.
- [ ] Download the AI Studio project (or push it to GitHub) for reference in SPOT-50.

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

---

## E1 Foundation

### SPOT-10 · Monorepo scaffold and local dev

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| DevOps · 2 | P0 | In review | — |

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

### SPOT-12 · CI pipeline

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| DevOps · 2 | P0 | Done | SPOT-11 |

**Sub-tasks**
- [x] GitHub Actions: backend job (ruff, mypy, pytest with coverage), frontend job (eslint,
  tsc, vitest, build).
- [x] Dependency audit job (`pip-audit`, `npm audit --audit-level=high`).
- [ ] OpenAPI drift check (added in SPOT-44). _(waits for SPOT-44)_
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

### SPOT-13 · Settings and configuration

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | In review | SPOT-10 |

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

### SPOT-14 · Postgres and custom user model

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | To do | SPOT-10, SPOT-13 |

Must be done **before the first `migrate`**: switching to a custom user model later means
rewriting migrations.

**Sub-tasks**
- [ ] Postgres 16 via `DATABASE_URL` (`dj-database-url`), `CONN_MAX_AGE` with health checks;
  Postgres in `docker-compose.yml` and in CI.
- [ ] `accounts` app with `User(AbstractUser)`: no username, unique case-insensitive email
  (RFC §3.1); `AUTH_USER_MODEL` set.

**Acceptance criteria**
- First migration creates `accounts.User`; tests run against Postgres in CI.

**Progress log**
- _Not started._

---

## E2 Domain (pure Python, no Django, no I/O)

### SPOT-20 · Units and geo utilities

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-10 |

**Sub-tasks**
- [ ] `units.py`: km/h→mph, mm→in, cm→in, lb→kg, km→mi. Nothing else in the codebase
  converts units.
- [ ] `geo.py`: haversine, cumulative polyline length, point at distance along a line,
  Douglas–Peucker simplify, local equirectangular buffer, point-in-polygon, lattice snapping.
- [ ] Polyline encode/decode (precision 5) and HERE flexible polyline decode.

**Acceptance criteria**
- Conversions tested against known values; geo functions tested on known city pairs (within
  0.5% of reference distances).

**Progress log**
- _Not started._

### SPOT-21 · Checkpoint sampling and owned miles

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-20 |

Spec: RFC §6.1, PRD §7.3, §7.5.

**Sub-tasks**
- [ ] Place checkpoints at 0, N, 2N … and always at the destination.
- [ ] Owned miles (half-gap to each neighbour), scaled to the provider's reported distance.
- [ ] Property tests with Hypothesis on random polylines.

**Acceptance criteria**
- Owned miles sum to the route distance (to 0.01 mi) for every generated polyline.
- Route shorter than N gives exactly two checkpoints (origin, destination).
- Intervals 10, 25 and 50 all work; anything else is rejected.

**Progress log**
- _Not started._

### SPOT-22 · ETA interpolation

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-20 |

Spec: RFC §6.2.

**Sub-tasks**
- [ ] Drive time at distance `d` from per-span durations; fallback to whole-route interpolation.
- [ ] Reverse lookup: distance at drive time `t` (needed for HOS stop locations).
- [ ] Forecast-hour selection: `ceil_to_hour(eta)` (RFC §6.3).

**Acceptance criteria**
- ETAs are non-decreasing along a route (property test).
- Forward then reverse lookup returns the original distance (to 0.01 mi).
- An ETA exactly on the hour selects that hour; one second past selects the next.

**Progress log**
- _Not started._

### SPOT-23 · Risk classification and load rules

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-20 |

Spec: PRD §7.4, RFC §6.4. **The highest-weighted logic in the assessment.**

**Sub-tasks**
- [ ] `Level` enum, threshold tables, `band()` and `band_with_strict_top()`.
- [ ] `apply_load_rules()` on gusts.
- [ ] `classify()` returning `RiskResult` with every intermediate level, the driver and the
  load rule applied; missing forecast → `UNKNOWN`.
- [ ] Table-driven tests written straight from the PRD table.

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
- _Not started._

### SPOT-24 · Hours of Service planner

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 5 | P1 | To do | SPOT-22 |

Spec: PRD §7.3.1, RFC §6.2.1.

**Sub-tasks**
- [ ] `HosRules`, `HosClocks`, `Cycle`, `Stop`, `HosPlan` types in integer seconds.
- [ ] Simulation loop with longest-stop-first ordering and an iteration guard.
- [ ] `clock_offset(drive_s)`.
- [ ] Map stops to miles and coordinates with the reverse lookup from SPOT-22.
- [ ] Table tests and Hypothesis invariants.

**Acceptance criteria**
- Rested driver, 12 h drive: break at 8 h, rest at 11 h, arrival = 12 h + 0.5 h + 10 h.
- Driver starting with 3 h of shift left and 11 h drive left: rest when the window runs out.
- Cycle 5 h left on a 12 h trip: 34 h restart at 5 h.
- Limits coinciding produce one stop (the longest).
- A trip ending exactly on a limit adds no stop.
- Invariants: no driving stretch breaks any limit; `clock_offset` is monotonic; stops don't
  overlap.

**Progress log**
- _Not started._

### SPOT-25 · Route metrics

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-21, SPOT-23 |

Spec: PRD §7.5, RFC §6.5.

**Sub-tasks**
- [ ] Miles by level including `UNKNOWN`; distance-weighted average risk excluding Unknown;
  worst level and its mile; drivable flag.

**Acceptance criteria**
- Miles by level sum to route distance.
- All-Unknown route has `avg_risk = None` and is not reported as safe.
- One No Travel checkpoint makes `drivable = false`.

**Progress log**
- _Not started._

### SPOT-26 · Ranking and recommendation reason

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-25 |

Spec: PRD §7.6, RFC §6.6.

**Sub-tasks**
- [ ] Sort key: No Travel miles, Severe miles, High miles (rounded), quantised average risk,
  duration (trip duration when HOS is on).
- [ ] Reason sentence from the first differing key against the runner-up.
- [ ] No recommendation when no route is drivable; warning when > 20% Unknown.

**Acceptance criteria**
- One test per criterion where all earlier criteria tie and that one decides.
- Average risks 1.02 and 1.04 tie (same 0.05 step); travel time decides.
- Ranking is deterministic for identical routes (stable by route id).
- Reason text tested for each criterion.

**Progress log**
- _Not started._

---

## E3 Providers

### SPOT-30 · Provider protocols, fakes and demo scenarios

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-20 |

**Sub-tasks**
- [ ] `RoutingProvider`, `WeatherProvider`, `Geocoder` protocols in `providers/base.py`.
- [ ] Fakes: fixed Dallas → Denver routes and a deterministic moving-storm weather model
  (same story as the UI prototype prompts), plus the stronger "No Travel" scenario.
- [ ] `PROVIDERS=fake|real` setting; responses flag `"demo": true` when fakes are used.

**Acceptance criteria**
- The whole app runs with no API keys and no network in fake mode.
- Demo scenario recommends Route A with "Fewest severe miles"; the strong scenario makes
  Route B not drivable.

**Progress log**
- _Not started._

### SPOT-31 · HERE truck routing adapter

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-30 |

Spec: RFC §5.1.

**Sub-tasks**
- [ ] Request with `transportMode=truck`, gross weight in kg, `departureTime`,
  `alternatives=4`, polyline, summary and duration/length spans.
- [ ] Parse to domain `Route`; reject responses missing geometry or durations.
- [ ] Recorded-fixture tests with `respx`.
- [ ] Verify quota and free-tier terms; note result in progress log (PRD Q3).

**Acceptance criteria**
- A real Dallas → Denver request returns ≥ 2 routes with geometry, distance and spans.
- Changing load weight is passed through to the request (asserted in a test).

**Progress log**
- _Not started._

### SPOT-32 · Route alternatives: dedupe and via-point fallback

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-31 |

Spec: RFC §5.1.

**Sub-tasks**
- [ ] Overlap measure on resampled polylines; drop routes > 85% overlapping a better one.
- [ ] Via-point fallback at ±10% of trip length perpendicular to the midpoint.
- [ ] `only_n_routes_found` warning when still short.

**Acceptance criteria**
- Two identical routes are reduced to one.
- When the provider returns 1 route, the fallback is tried and the result has up to 3 distinct
  routes or a warning.

**Progress log**
- _Not started._

### SPOT-33 · HERE autosuggest adapter

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | To do | SPOT-30 |

**Sub-tasks**
- [ ] Autosuggest call biased to North America; return label, lat, lon, time zone.
- [ ] Fixture tests.

**Acceptance criteria**
- "dall" returns Dallas, TX first with coordinates and `America/Chicago`.

**Progress log**
- _Not started._

### SPOT-34 · Open-Meteo forecast adapter

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-30 |

Spec: RFC §5.2, §6.3.

**Sub-tasks**
- [ ] Multi-location requests, ≤ 100 locations per batch, metric units, `unixtime`.
- [ ] Parse to `Forecast` per hour: gust/sustained mph, rain = rain + showers in/hr, snow in/hr.
- [ ] `null`/`NaN` → missing; out-of-range hours → missing.

**Acceptance criteria**
- Units converted only via `units.py` (asserted by a test on a fixture with known values).
- A fixture with a `null` gust gives `UNKNOWN` downstream, never Low.

**Progress log**
- _Not started._

### SPOT-35 · Forecast cache

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-34, SPOT-13 |

Spec: RFC §9, §18.2, §18.3, §18.4.

**Sub-tasks**
- [ ] Lattice snapping (0.1° checkpoints, 0.25° grid) and cache-first fetch of missing points.
- [ ] Keys prefixed with `RULES_VERSION` and a payload schema version.
- [ ] Single-flight: Redis `SET NX` lock per key, others wait up to 2 s for the value.
- [ ] Stale-while-revalidate: keep entries 3 h past freshness; serve stale with a `stale` flag
  when the provider fails.

**Acceptance criteria**
- Second identical plan makes zero Open-Meteo calls (asserted with a counting fake).
- 10 concurrent requests for the same cold key make one upstream call.
- Provider down + stale entry → plan succeeds with `stale: true`.
- Bumping `RULES_VERSION` misses every old key.

**Progress log**
- _Not started._

### SPOT-36 · Provider resilience

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-31, SPOT-34 |

Spec: RFC §18.3.

**Sub-tasks**
- [ ] Shared `httpx` client with 3 s connect / 10 s read timeouts.
- [ ] One retry with jitter on timeout and 5xx, GET only.
- [ ] Per-provider circuit breaker (5 failures → open 30 s → half-open).
- [ ] Map failures to `routing_unavailable` / `weather_unavailable`.

**Acceptance criteria**
- Tests: timeout retried once; 4xx not retried; breaker opens after 5 failures and fails fast;
  closes after a successful half-open call.

**Progress log**
- _Not started._

---

## E4 API

### SPOT-40 · Plan service orchestration

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-21–26, SPOT-32, SPOT-35 |

**Sub-tasks**
- [ ] `plan_trip(request)`: routes → checkpoints → ETAs (+ HOS) → forecasts (one batched call
  across all routes) → risk → metrics → ranking.
- [ ] Return domain objects; saving as a trip is SPOT-111.
- [ ] Add `rules_version`, `generated_at`, `stale`, warnings.

**Acceptance criteria**
- End-to-end test with fakes reproduces the demo scenario exactly (golden JSON file).
- Forecasts for all three routes are fetched in one batched pass, not per route.
- Cold plan with fakes plus 300 ms simulated latency per provider call finishes in < 2 s.

**Progress log**
- _Not started._

### SPOT-41 · `POST /api/v1/plans` endpoint

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-40 |

Spec: RFC §7.2, §11.

**Sub-tasks**
- [ ] Request/response serializers including HOS block and its cross-field rules.
- [ ] Single error shape `{"error": {"code", "message", "fields"?}}` via a DRF exception handler.

**Acceptance criteria**
- Invalid interval, weight, departure window, identical origin/destination and each HOS rule
  return 400 `invalid_input` with the field named.
- `no_route` → 422; provider failures → 502 with the right code.

**Progress log**
- _Not started._

### SPOT-42 · Corridor grid and heatmap endpoint

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 3 | P0 | To do | SPOT-40, SPOT-111 |

Spec: RFC §7.3, §8.

**Sub-tasks**
- [ ] Union of simplified routes, 40 mi buffer, lattice points inside, point cap with coarser
  step.
- [ ] Classify every point-hour (0–48) with `classify()` and the plan's load.
- [ ] `GET /api/v1/trips/{id}/heatmap`: compute from the stored trip on first request, save as
  `TripHeatmap`, read the saved copy afterwards; same access rules as the trip.

**Acceptance criteria**
- Coast-to-coast plan stays under the point cap.
- Payload for ~600 points < 20 KB gzipped.
- A grid point that equals a checkpoint location and hour has the same level as the checkpoint.

**Progress log**
- _Not started._

### SPOT-43 · Geocode suggest endpoint

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | To do | SPOT-33 |

**Sub-tasks**
- [ ] `GET /api/v1/geocode/suggest?q=`; min 2 characters; 24 h cache.

**Acceptance criteria**
- Query under 2 characters returns an empty list without calling the provider.

**Progress log**
- _Not started._

### SPOT-44 · OpenAPI schema and TS type generation

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Full stack · 1 | P0 | To do | SPOT-41 |

**Sub-tasks**
- [ ] drf-spectacular schema at `/api/v1/schema`; committed `openapi.yaml`.
- [ ] `openapi-typescript` generates `frontend/src/api/schema.d.ts`.
- [ ] CI fails if the committed schema or generated types are out of date.

**Acceptance criteria**
- Renaming a response field without regenerating fails CI.

**Progress log**
- _Not started._

### SPOT-45 · Security settings, throttling, health checks

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 2 | P0 | To do | SPOT-41 |

Spec: RFC §12, §18.3.

**Sub-tasks**
- [ ] DRF throttles: plans 10/min per guest, 30/min per user; heatmap 20/min; geocode 60/min.
- [ ] Secure, httpOnly, `SameSite=Lax` session and CSRF cookies; `CSRF_TRUSTED_ORIGINS`;
  `ALLOWED_HOSTS`, HTTPS redirect, HSTS, security middleware. No CORS (one origin).
- [ ] `/healthz` and `/readyz` (Redis ping, settings check).

**Acceptance criteria**
- 11th plan request in a minute gets 429 `rate_limited`.
- `/readyz` returns 503 when Redis is down.
- `manage.py check --deploy` passes with prod settings.

**Progress log**
- _Not started._

### SPOT-46 · Structured logging and request ids

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Backend · 1 | P0 | To do | SPOT-40 |

**Sub-tasks**
- [ ] JSON logs; request id middleware; `X-Request-ID` response header.
- [ ] One summary line per plan: provider latencies, cache hit ratio, checkpoint and grid
  counts, stale flag.

**Acceptance criteria**
- A plan's log lines (including provider calls) can be found by request id.

**Progress log**
- _Not started._

---

## E5 Frontend base

### SPOT-50 · App shell, theme and design tokens

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-4, SPOT-10 |

**Sub-tasks**
- [ ] Two-pane layout and header from the agreed design.
- [ ] Tokens: risk palette, accent, spacing, type; light and dark themes.
- [ ] `lib/risk.ts`: level → colour, label, score (single source for map and UI).

**Acceptance criteria**
- Theme toggle switches every surface including map overlays.
- Risk colours come only from `lib/risk.ts` (no hex codes elsewhere).

**Progress log**
- _Not started._

### SPOT-51 · API client, query layer and UI state

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-44 |

**Sub-tasks**
- [ ] Typed fetch client on generated types; error shape parsed into a typed error.
- [ ] TanStack Query: plan mutation, dependent heatmap query (routing and session are SPOT-120).
- [ ] UI store (selected route, hovered/selected checkpoint, layer toggles); slider hour in
  its own context.

**Acceptance criteria**
- Heatmap request starts only after the plan resolves; routes render before it finishes.
- Changing the slider hour doesn't re-render the routes panel (checked with React Profiler).

**Progress log**
- _Not started._

---

## E6 Planning UI

### SPOT-60 · Trip form with autosuggest

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-51, SPOT-43 |

Spec: PRD §7.1.

**Sub-tasks**
- [ ] Origin/destination comboboxes (250 ms debounce, keyboard navigation, swap button).
- [ ] Departure picker in the origin's time zone; > 48 h note.
- [ ] Load weight with thousands separators; interval segmented control.
- [ ] zod schema mirroring server validation; server field errors shown inline.

**Acceptance criteria**
- Every server validation rule also fails client-side with the same message.
- Form is fully usable by keyboard.

**Progress log**
- _Not started._

### SPOT-61 · Hours of Service fields

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P1 | To do | SPOT-60 |

Spec: PRD §7.3.1.

**Sub-tasks**
- [ ] Toggle (off by default) revealing cycle select and four ELD-style clocks (`hh:mm`).
- [ ] Cross-field validation (Drive ≤ Shift, Drive ≤ Cycle); cycle max follows the cycle type.
- [ ] "How is this calculated?" popover listing rules and simplifications.

**Acceptance criteria**
- With the toggle off, no HOS fields are sent (`{"enabled": false}`).
- Switching to 60 h / 7 days clamps a 70 h cycle value with a visible message.

**Progress log**
- _Not started._

### SPOT-62 · Route cards and recommendation

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-51 |

**Sub-tasks**
- [ ] Ranked cards: badge and reason, distance, drive time, arrival with zone, average risk,
  worst level pill, stacked miles-by-level bar with tooltips.
- [ ] Not drivable tag; no-safe-route alert; warnings banner; stale forecast banner.
- [ ] HOS summary and expandable stop list when HOS is on.
- [ ] Card ↔ map selection and hover sync.

**Acceptance criteria**
- Every number on a card matches the API response (component tests on the demo fixture).
- Selecting a card selects the route on the map and vice versa.

**Progress log**
- _Not started._

### SPOT-63 · Checkpoint table

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-62 |

**Sub-tasks**
- [ ] Table for the selected route: mile, ETA, gust, rain, snow, level.
- [ ] Row click flies the map to the checkpoint and opens its popup.

**Acceptance criteria**
- Long routes (200+ rows) scroll smoothly (virtualised if needed).

**Progress log**
- _Not started._

### SPOT-64 · Empty, loading, partial and error states

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-62 |

Spec: PRD §9, RFC §11.

**Sub-tasks**
- [ ] Empty state with explainer; skeletons for routes; heatmap fade-in.
- [ ] Partial results (< 3 routes, Unknown checkpoints), not drivable, no safe route.
- [ ] Error state per error code with retry; 429 message.

**Acceptance criteria**
- Each state reachable through the fake providers and covered by a component test.
- No state shows missing data as Low or as blank.

**Progress log**
- _Not started._

---

## E7 Map

### SPOT-70 · Map view, basemap and camera

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 2 | P0 | To do | SPOT-50 |

**Sub-tasks**
- [ ] `react-map-gl/maplibre` with OpenFreeMap positron (and a dark style for dark mode).
- [ ] Fit to routes with padding for the left panel; origin/destination pins.

**Acceptance criteria**
- Map loads without any token; camera fits all routes after each plan.

**Progress log**
- _Not started._

### SPOT-71 · Routes layer with risk-coloured segments

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-70 |

**Sub-tasks**
- [ ] One GeoJSON source per plan (memoised); decode polylines once.
- [ ] Unselected routes grey; selected route split into segments coloured by checkpoint risk,
  with casing.
- [ ] Selection and hover via filters/paint expressions, not new data.

**Acceptance criteria**
- Changing selection doesn't call `setData` (asserted in a test with a mocked map).

**Progress log**
- _Not started._

### SPOT-72 · Checkpoints layer, tooltip and popup

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 3 | P0 | To do | SPOT-70 |

**Sub-tasks**
- [ ] Single `circle` layer, colour by level, zoom-scaled radius; hover via `feature-state`.
- [ ] Tooltip (level, ETA) and popup (mile, ETA, gust, sustained "for info", rain, snow,
  level, driver, load rule sentence).

**Acceptance criteria**
- 600+ checkpoints pan and zoom at 60 fps.
- Popup text for a load-rule checkpoint reads e.g. "Raised High → Severe: gust 38 mph with a
  42,000 lb load (> 40,000 lb rule)".

**Progress log**
- _Not started._

### SPOT-73 · HOS stops layer

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 1 | P1 | To do | SPOT-72, SPOT-24 |

**Sub-tasks**
- [ ] Symbol layer with break, rest and restart icons; popup with start, duration, reason.

**Acceptance criteria**
- Shown only when HOS is on; stop positions match the API's coordinates.

**Progress log**
- _Not started._

### SPOT-74 · Legend and layer toggles

| Effort | Priority | Status | Depends on |
|---|---|---|---|
| Frontend · 1 | P0 | To do | SPOT-72 |

**Sub-tasks**
- [ ] Collapsible legend (six levels with labels); toggles for heatmap, checkpoints, other
  routes.

**Acceptance criteria**
- Toggles change layer visibility only (no data reload).

**Progress log**
- _Not started._

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
- [ ] Chrome trace for pan/zoom and slider scrubbing; bundle size report.
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
