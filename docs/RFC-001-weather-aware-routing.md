# RFC-001: Weather-Aware Truck Routing — Technical Design

| | |
|---|---|
| **Status** | Draft |
| **Date** | 2026-10-11 |
| **PRD** | [PRD.md](./PRD.md) |
| **Stack** | Django 5 + Django REST Framework · React 18 + TypeScript + Vite · MapLibre GL |

---

## 1. Summary

A Django API takes a trip request, fetches 3 truck routes from a routing provider, places
checkpoints every N miles, works out an ETA for each, looks up the hourly forecast for that
ETA, applies the risk and load rules, ranks the routes and returns everything in one response.
A second endpoint returns a precomputed 49-hour risk grid over the corridor. The React client
draws routes, checkpoints and the heatmap with MapLibre GL, and scrubs the heatmap by changing a
paint expression, so the slider never touches the network or re-uploads data.

All rule logic lives in a pure Python package with no Django or network imports, so it can be
tested exhaustively and read on its own. That is where 40% of the grade is.

## 2. Context and constraints

- Evaluation weights: logic 40%, UI/map/heatmap performance 35%, code quality 10%, docs 5%.
  Effort follows the weights: the domain package and the map are where the time goes.
- "Prioritise correctness and clarity over extra features."
- Third-party routing, geocoding and weather are allowed. Free tiers are preferred, but quotas
  shape the design (caching, grid snapping, batching).
- It must be hosted and stay responsive when a reviewer opens it cold.

## 3. Architecture

```
                         ┌────────────────────────────┐
  Browser                │  React SPA (Vite, TS)      │
                         │  TanStack Query · MapLibre │
                         └─────────────┬──────────────┘
                                       │ HTTPS / JSON
                         ┌─────────────▼──────────────┐
                         │  Django + DRF  (API only)  │
                         │                            │
                         │  accounts/   custom user, allauth headless (sessions)
                         │  api/        views, serializers, throttling, access checks
                         │  services/   orchestration: plan_trip(), corridor_grid()
                         │  providers/  HERE routing+geocode, Open-Meteo weather
                         │  domain/     pure logic: sampling, eta, risk, metrics, ranking
                         └───┬───────────┬────────────┘
                             │           │
                ┌────────────▼─┐   ┌─────▼──────────┐    ┌────────────────┐
                │ Cache (Redis)│   │ HERE APIs      │    │ Open-Meteo API │
                │ forecasts,   │   │ routing v8     │    │ hourly forecast│
                │ routes, geo, │   │ autosuggest    │    │ multi-location │
                │ sessions     │   └────────────────┘    └────────────────┘
                └──────────────┘
                ┌──────────────┐
                │ Postgres     │  users, trips, routes, heatmaps, sessions
                └──────────────┘
```

**Synchronous request/response, no task queue.** A cold plan is a handful of outbound calls
that can run in parallel and finish in a few seconds. Celery and a worker would add moving parts
and hosting cost for no gain at this scale. If cold latency goes over budget, the first fix is
more caching and parallelism; the second is moving the heatmap to a background job with polling.

**Persistence.** Every plan is saved to Postgres as a **trip** snapshot, owned by either a
signed-in user or a guest session (PRD §7.9). Redis stays the store for short-lived data:
forecasts, routing and geocoding results, locks, throttle counters.

### 3.1 Data model

Two Django apps: `accounts` (the user) and `planner` (trips). Heavy, always-read-together data
(checkpoints, HOS stops, heatmap grid) is stored as JSON on its parent row; everything we filter,
sort or summarise on is a real column with constraints.

```python
# accounts/models.py: custom user from the first migration (swapping it later is painful)
class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []
    objects = EmailUserManager()                 # normalises email to lower case

    class Meta:
        constraints = [UniqueConstraint(Lower("email"), name="user_email_ci_unique")]
```

```python
# planner/models.py
class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE,
                             related_name="trips")
    guest_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    rules_version = models.CharField(max_length=16)
    snapshot_version = models.PositiveSmallIntegerField()      # shape of the JSON fields
    idempotency_key = models.UUIDField(null=True, blank=True, unique=True)
    replanned_from = models.ForeignKey("self", null=True, blank=True,
                                       on_delete=models.SET_NULL, related_name="replans")
    # user-controlled
    name = models.CharField(max_length=120, blank=True)
    saved = models.BooleanField(default=False)
    shared = models.BooleanField(default=False)
    # inputs
    origin_label = models.CharField(max_length=200)
    origin_lat = models.DecimalField(max_digits=8, decimal_places=5)
    origin_lon = models.DecimalField(max_digits=8, decimal_places=5)
    origin_tz = models.CharField(max_length=64)
    # destination_label / _lat / _lon / _tz: same as origin
    departure = models.DateTimeField()                          # UTC
    load_lb = models.PositiveIntegerField()
    interval_mi = models.PositiveSmallIntegerField(choices=Interval.choices)
    hos = models.JSONField(null=True, blank=True)               # clocks, when HOS was on
    # outcome
    recommendation_reason = models.CharField(max_length=200, blank=True)
    warnings = models.JSONField(default=list)
    stale = models.BooleanField(default=False)
    demo = models.BooleanField(default=False)

    class Meta:
        constraints = [
            CheckConstraint(name="trip_has_exactly_one_owner",
                condition=Q(user__isnull=False, guest_id__isnull=True)
                        | Q(user__isnull=True, guest_id__isnull=False)),
            CheckConstraint(name="trip_only_users_save",
                condition=Q(saved=False) | Q(user__isnull=False)),
            CheckConstraint(name="trip_load_in_range",
                condition=Q(load_lb__gte=1, load_lb__lte=80_000)),
            CheckConstraint(name="trip_valid_interval",
                condition=Q(interval_mi__in=[10, 25, 50])),
        ]
        indexes = [
            Index(fields=["user", "-created_at"], name="trip_user_recent"),
            Index(fields=["guest_id", "-created_at"], name="trip_guest_recent"),
        ]


class TripRoute(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="routes")
    rank = models.PositiveSmallIntegerField()                   # 1 = best
    recommended = models.BooleanField(default=False)
    name = models.CharField(max_length=80)
    geometry = models.TextField()                               # encoded polyline
    distance_mi = models.FloatField()
    duration_s = models.PositiveIntegerField()                  # driving only
    trip_duration_s = models.PositiveIntegerField()             # incl. HOS stops
    departure = models.DateTimeField()
    arrival = models.DateTimeField()
    low_mi = moderate_mi = high_mi = severe_mi = no_travel_mi = unknown_mi = models.FloatField()
    avg_risk = models.FloatField(null=True)
    worst_level = models.CharField(max_length=10, choices=Level.choices, null=True)
    drivable = models.BooleanField()
    checkpoints = models.JSONField()                            # list, read as a whole
    hos_stops = models.JSONField(default=list)

    class Meta:
        constraints = [
            UniqueConstraint(fields=["trip", "rank"], name="route_unique_rank"),
            UniqueConstraint(fields=["trip"], condition=Q(recommended=True),
                             name="route_one_recommended_per_trip"),
            CheckConstraint(name="route_rank_1_to_3", condition=Q(rank__gte=1, rank__lte=3)),
            CheckConstraint(name="route_recommended_is_drivable",
                            condition=Q(recommended=False) | Q(drivable=True)),
            CheckConstraint(name="route_avg_risk_range",
                            condition=Q(avg_risk__isnull=True)
                                    | Q(avg_risk__gte=0, avg_risk__lte=4)),
            CheckConstraint(name="route_arrival_after_departure",
                            condition=Q(arrival__gte=F("departure"))),
        ]


class TripHeatmap(models.Model):                                # computed on first request
    trip = models.OneToOneField(Trip, primary_key=True, on_delete=models.CASCADE,
                                related_name="heatmap")
    start_hour = models.DateTimeField()
    cell_deg = models.FloatField()
    points = models.JSONField()
    risk = models.JSONField()
```

(The six `*_mi` fields are written out separately in the real code; they're on one line here
for brevity.)

**Why checkpoints are JSON, not rows.** They're always read with their route and never queried
on their own. As rows they'd be ~600 inserts per trip with no query that needs them. If we later
want cross-trip analysis ("where do Severe miles cluster?"), that's the time to normalise.

**Writes.** `plan_trip()` returns domain objects; the API serializes them into the plan
response, and `planner/repositories.py` saves that response as the trip and its routes inside
one `transaction.atomic()`: columns for what is filtered or summarised, JSON for checkpoints
and HOS stops. The stored shape is the versioned response (`snapshot_version`), never dumped
dataclasses, so old trips stay readable after the domain changes, and reading a trip back
gives exactly the response it was saved from. The domain package still imports nothing from
Django.

**Reads.** The trip list defers the heavy columns (`checkpoints`, `hos_stops`, `geometry`) and
prefetches routes in one query, so listing 20 trips is 2 queries regardless of size, which is
asserted with `django_assert_num_queries`.

**Retention.** `manage.py purge_trips`, run daily by the host's scheduler: delete guest trips
older than 30 days and unsaved user trips older than 90 days; then `clearsessions`.

### 3.2 Identity: guests and accounts

- **Sessions, not JWTs.** Django's session auth with an httpOnly, Secure, `SameSite=Lax`
  cookie. JavaScript can't read the cookie, logout and account deletion revoke access on the
  server immediately, and it's built into Django and DRF with CSRF protection. JWTs would add
  refresh-token rotation and a storage problem (localStorage is readable by any XSS) for no
  benefit in a single web client.
- **Same-site deployment.** The frontend host proxies `/api/*` to Django (a Vercel rewrite), so
  the browser sees one origin: cookies are first-party, and CORS isn't needed at all. Cross-site
  cookies would be blocked by Safari and increasingly by Chrome.
- **Auth library:** `django-allauth` in headless mode (browser client): email-and-password
  sign-up, login, logout and session endpoints for SPAs, with login rate limiting built in.
  Mounted under `/api/auth/`. Email verification is off for the assessment (PRD §7.9).
- **Passwords:** Argon2 hasher (`argon2-cffi`) and Django's password validators.
- **Guests.** On a guest's first plan, the server stores a random `guest_id` UUID in their
  session (sessions use the `cached_db` backend: Redis for speed, Postgres for durability).
  The guest session cookie lasts 30 days, matching guest trip retention.
- **Claiming guest trips.** A `user_logged_in` signal handler (fires on login and after sign-up)
  runs, in one transaction,
  `Trip.objects.filter(guest_id=gid, user=None).update(user=user, guest_id=None)`, then
  removes `guest_id` from the session. Django's `login()` rotates the session key but keeps its
  data, so the `guest_id` is still there when the handler runs.
- **Logout** flushes the session; the next plan starts a new guest.
- **One access check.** `planner/access.py` defines `Owner` (a user or a guest id) and
  `get_visible_trip(trip_id, owner)`. It returns the trip if the owner matches or the trip is
  shared, and raises `Http404` otherwise. Every trip endpoint goes through it; no view filters
  trips by hand. Write actions use `get_owned_trip()`, which ignores `shared`.
- **Demo account.** `manage.py seed_demo` creates a reviewer account with a few saved trips from
  the fake providers; credentials go in the README.


## 4. Repository layout

```
spotter/
├── backend/
│   ├── config/                 # settings (split base/local/prod), urls, wsgi
│   ├── accounts/               # custom User (email login), allauth config, guest-claim signal
│   ├── planner/
│   │   ├── domain/             # PURE: no Django, no I/O
│   │   │   ├── units.py
│   │   │   ├── geo.py          # haversine, polyline length, interpolate along line, buffer grid
│   │   │   ├── sampling.py     # checkpoints every N miles + owned miles
│   │   │   ├── eta.py          # distance → elapsed driving time (span interpolation)
│   │   │   ├── hos.py          # Hours of Service planner: stops + drive time → clock time
│   │   │   ├── risk.py         # thresholds, load rules, classify()
│   │   │   ├── metrics.py      # per-route aggregation
│   │   │   ├── ranking.py      # recommendation + reason
│   │   │   └── types.py        # dataclasses: Route, Checkpoint, Forecast, RiskResult …
│   │   ├── providers/
│   │   │   ├── base.py         # RoutingProvider, WeatherProvider, Geocoder protocols
│   │   │   ├── here.py
│   │   │   ├── open_meteo.py
│   │   │   └── fakes.py        # deterministic fixtures for tests and offline dev
│   │   ├── models.py           # Trip, TripRoute, TripHeatmap (§3.1)
│   │   ├── repositories.py     # domain objects <-> models, versioned JSON snapshots
│   │   ├── access.py           # Owner, get_visible_trip / get_owned_trip
│   │   ├── management/commands/ # purge_trips, seed_demo
│   │   ├── services/
│   │   │   ├── plan.py         # plan_trip(request) -> PlanResult
│   │   │   └── corridor.py     # corridor_grid(routes, load) -> HeatmapGrid
│   │   └── api/                # serializers, views, urls, throttles
│   └── tests/                  # mirrors planner/; domain tests are table-driven
├── frontend/
│   └── src/
│       ├── api/                # typed client (types generated from OpenAPI)
│       ├── features/
│       │   ├── trip-form/
│       │   ├── routes-panel/
│       │   ├── map/            # MapView, layers/RoutesLayer, CheckpointsLayer, HeatmapLayer
│       │   ├── heatmap-slider/
│       │   ├── auth/           # session query, login/sign-up pages, CSRF handling
│       │   └── trips/          # My trips, trip page, recent-trips menu, share/save actions
│       ├── routes.tsx          # react-router: /, /trips, /trips/:id, /login, /signup, /account
│       ├── lib/                # risk colours, formatters, time zone helpers
│       └── App.tsx
├── docs/                       # PRD, RFC, ADR notes
└── docker-compose.yml          # api + postgres + redis + web for local dev
```

## 5. Third-party providers

### 5.1 Routing and geocoding: HERE (chosen)

| Option | Truck-aware | Alternatives | Notes |
|---|---|---|---|
| **HERE Routing v8** | Yes, `transportMode=truck` with gross weight | Multiple alternatives per request | Traffic-aware `departureTime`; same key covers Geocoding & Search (autosuggest). Free monthly allowance. |
| OpenRouteService | Yes, `driving-hgv` | Alternative routes limited to short trips on the public API | Free, but fails the "3 options" requirement for long-haul |
| Mapbox Directions | Car-oriented | Primary + up to 2 alternatives | Good DX; no real truck model |
| Google Routes | No truck mode | Up to 3 alternatives | Costly; car-oriented |
| OSRM (public demo) | No | Few, unreliable | Not suitable for a hosted app |

HERE is the only free-tier option that is both truck-aware and returns several alternatives on
long trips. Passing the load weight to routing is a small but real win: a heavier truck may get
different routes, which is the sort of thing a truck-focused reviewer will notice.

**Integration notes**

- Request: `origin`, `destination`, `transportMode=truck`, `vehicle[grossWeight]=<kg>`,
  `departureTime=<ISO>`, `alternatives=4`, `return=polyline,summary,routeLabels`, and
  `spans=dynamicSpeedInfo,length,duration` so ETAs can follow real speed changes along the
  route. `length` and `duration` are metadata that never start a span on their own, so asking
  for them alone gives one span per section; `dynamicSpeedInfo` starts a new span whenever
  the expected speed changes.
- Geometry comes back as HERE *flexible polyline*; decode with the official `flexpolyline`
  package.
- Ask for more alternatives than needed (4), then **de-duplicate**: drop any route whose
  geometry overlaps a better-ranked one by more than 85% (measured on a resampled polyline).
  Keep the fastest 3 survivors.
- **Fewer than 3 distinct routes:** request via-point routes through points offset
  perpendicular to the origin–destination line at its midpoint (±10% of trip length), then
  de-duplicate again. If still fewer than 3, return what we have with
  `warnings: ["only_n_routes_found"]`.
- The provider sits behind a `RoutingProvider` protocol, so switching to Mapbox or ORS is one
  new adapter.
- **Free tier only (PRD Q3, resolved 2026-10-14).** HERE's Base Plan gives 4,000 free
  transactions a month for each service, routing and autosuggest counted separately; anything
  over is billed to the card on file. The app stops calling a service once it has used 90% of
  its allowance (3,600), until the next calendar month in UTC; requests then fail with 503
  `quota_reached`. The count is a Postgres row per service per month (`ProviderUsage`), taken
  with one conditional UPDATE so concurrent workers can't overspend, and every request counts,
  retries included. Allowances are settings (`HERE_ROUTING_MONTHLY_ALLOWANCE`,
  `HERE_AUTOSUGGEST_MONTHLY_ALLOWANCE`); usage is visible in the Django admin.
- The first real request (Dallas → Denver, 80,000 lb, 2026-10-14) returned 5 routes with
  geometry, distance and `dynamicSpeedInfo` spans; 3 survived de-duplication, so no via-point
  fallback was needed. HERE's flexible polylines came back at precision 6.

### 5.2 Weather: Open-Meteo (chosen)

- Free, no API key, hourly forecast up to 16 days, global, and uses high-resolution models over
  North America (e.g. HRRR) through `best_match`.
- **Multi-location requests:** comma-separated latitudes and longitudes in one call. This makes
  hundreds of checkpoints a few HTTP requests.
- Variables: `wind_speed_10m`, `wind_gusts_10m`, `rain`, `showers`, `snowfall`, `weather_code`,
  `temperature_2m` (the last two for display only).
- We ask for **metric units and convert in one place** (`domain/units.py`), so no unit
  assumption hides in a query string: km/h → mph, mm → in for rain, cm → in for snowfall.
  Times come back as Unix timestamps in UTC (`timeformat=unixtime`).
- Rain rate = `rain + showers` for the hour; snow rate = `snowfall` for the hour.
- **Quota (checked 2026-10-14):** the free tier is non-commercial and allows 600 calls a
  minute, 5,000 an hour and 10,000 a day from one address, so from the whole deployment. A
  multi-location request weighs `locations × max(1, days / 14) × max(1, variables / 10)`
  calls; our 10-day, 6-variable requests cost one call per location. Past a limit it answers
  429 with a reason ("Minutely API request limit exceeded").
- **Staying under it:** every point is snapped to the 0.25° lattice the heatmap uses (§9), so a
  trip's heatmap reuses its checkpoints' forecasts; entries stay fresh for 3 h; the heatmap
  corridor is 30 mi and capped at 500 points (§8). A cold 10 mi Dallas → Denver plan is 131
  calls and its heatmap 453 including those. Before each batch goes out, its weight is reserved
  against 90% of each limit (540 a minute, 4,500 an hour, 9,000 a day), counted in Redis with a
  sliding window (`providers/rate_budget.py`). When a window is full, the batches that fit are
  fetched and cached, and the request fails with 503 `weather_busy` and `Retry-After`; stale
  forecasts cover it when they can (§11). A 429 from Open-Meteo itself is treated the same way.
  The free tier covers about 15 cold trips a day; a commercial key would lift the limits.

Alternatives considered: NWS API (US-only, one gridpoint per request, slow fan-out),
Tomorrow.io / OpenWeather (keys and tighter free quotas, no real advantage).

## 6. Domain logic

Everything here is in `planner/domain/`, uses plain dataclasses, and is tested without Django.

### 6.1 Sampling checkpoints

Input: decoded polyline (lat/lon list), interval `N ∈ {10, 25, 50}` miles.

1. Compute cumulative haversine distance along the polyline.
2. Place checkpoints at `0, N, 2N, …` miles by linear interpolation on the segment that contains
   that distance. Always add the destination as the last checkpoint (it may be closer than `N`
   to the one before it).
3. **Owned miles:** checkpoint `i` owns from the midpoint with `i-1` to the midpoint with `i+1`.
   The first and last own half a gap. The sum is exactly the route length, which is a property
   test.

The polyline length is used for spacing. The provider's reported distance is used for the
summary. They differ slightly; owned miles are scaled so they add up to the reported distance.

### 6.2 ETAs

1. **Base travel time:** use the provider's per-span duration and length. Elapsed time at a
   distance `d` is the cumulative duration up to the span containing `d`, plus linear
   interpolation inside it. If spans are missing, fall back to interpolating over the whole
   route's duration (documented as less accurate).
2. **ETA** = departure + elapsed time (UTC).
3. **Hours of Service (optional, off by default):** when on, elapsed driving time is turned into
   clock time by the HOS planner (§6.2.1) before adding it to departure.

#### 6.2.1 HOS planner

Lives in `domain/hos.py`. It's a pure function: it takes total driving time and the driver's
starting clocks, and returns the stops plus a function from driving time to clock time.

```python
@dataclass(frozen=True)
class HosRules:                      # US property-carrying, constants not settings
    max_drive_s: int = 11 * 3600
    window_s: int = 14 * 3600
    drive_before_break_s: int = 8 * 3600
    break_s: int = 30 * 60
    rest_s: int = 10 * 3600
    restart_s: int = 34 * 3600

class Cycle(Enum):
    H70_8D = 70 * 3600
    H60_7D = 60 * 3600

@dataclass(frozen=True)
class HosClocks:                     # what the driver's ELD shows, all "remaining"
    cycle: Cycle
    drive_left_s: int                # ≤ 11 h
    window_left_s: int               # ≤ 14 h
    until_break_s: int               # ≤ 8 h
    cycle_left_s: int                # ≤ 60/70 h

class StopKind(Enum):
    BREAK = "break"                  # 30 min
    REST = "rest"                    # 10 h
    RESTART = "restart"              # 34 h

@dataclass(frozen=True)
class Stop:
    kind: StopKind
    at_drive_s: int                  # driving time completed when the stop starts
    duration_s: int
    reason: Literal["break", "drive_limit", "window", "cycle"]

@dataclass(frozen=True)
class HosPlan:
    stops: list[Stop]
    def clock_offset(self, drive_s: float) -> float: ...   # drive time -> elapsed clock time
```

**Simulation loop.** Drive until the nearest limit, take the stop that limit needs, repeat:

```python
def plan_hos(total_drive_s: int, c: HosClocks, r: HosRules = HosRules()) -> HosPlan:
    stops, driven = [], 0
    drive_left, window_left, until_break, cycle_left = (
        c.drive_left_s, c.window_left_s, c.until_break_s, c.cycle_left_s)
    while True:
        step = max(0, min(total_drive_s - driven, cycle_left, drive_left, window_left, until_break))
        driven += step
        drive_left -= step; window_left -= step; until_break -= step; cycle_left -= step
        if driven >= total_drive_s:
            return HosPlan(stops)
        remaining = {"cycle": cycle_left, "drive_limit": drive_left,
                     "window": window_left, "break": until_break}
        hit = next(k for k in ("cycle", "drive_limit", "window", "break") if remaining[k] <= 0)
        if hit == "cycle":
            stops.append(Stop(RESTART, driven, r.restart_s, "cycle"))
            drive_left, window_left, until_break = r.max_drive_s, r.window_s, r.drive_before_break_s
            cycle_left = c.cycle.value
        elif hit in ("drive_limit", "window"):
            stops.append(Stop(REST, driven, r.rest_s, hit))
            drive_left, window_left, until_break = r.max_drive_s, r.window_s, r.drive_before_break_s
        else:                                            # break
            stops.append(Stop(BREAK, driven, r.break_s, "break"))
            until_break = r.drive_before_break_s
            window_left -= r.break_s                     # breaks don't pause the 14 h window
```

- **Order of checks** is longest stop first (cycle, then the two 10-hour limits, then the break),
  so when limits coincide we take one stop that satisfies all of them. A 10 h rest also counts as
  the 30 min break; a 34 h restart counts as everything.
- **Window after a break:** if a 30 min break would use up the rest of the 14 h window, the
  driver would need a 10 h rest straight after it, and that rest also counts as the break. So the
  planner takes the rest instead (reason `window`), and two stops never fall at the same point.
  (The loop above, taken literally, would schedule the break and then the rest.)
- **Starting at zero:** if any clock starts at 0, the first step drives 0 and the matching stop is
  inserted at mile 0, e.g. a driver with no drive time left starts with a 10 h rest.
- **Cycle:** `cycle_left` is only spent by driving (all on-duty time is driving here) and does
  not recover as old days roll off the 8-day window. This is conservative and is written down in
  PRD §7.3.1.
- **Termination:** every iteration either finishes the trip or adds a stop that resets a positive
  clock, and validation guarantees the reset values are positive, so the loop ends. A guard of
  1,000 iterations raises if that is ever broken.

`clock_offset(d)` = `d` + the sum of `duration_s` for every stop with `at_drive_s < d` (a stop
exactly at `d` belongs after the truck arrives at `d`). Checkpoint ETA =
`departure + clock_offset(drive_time_to_checkpoint)`. Arrival is the same with the total drive
time. Stop locations on the map come from turning `at_drive_s` back into a distance with the
same span interpolation as §6.2 step 1, run in reverse.

Times are integer seconds throughout, so limit checks are exact and tests don't need float
tolerances.

### 6.3 Forecast lookup

Open-Meteo hourly `rain`/`snowfall` at timestamp `T` is the total over the **preceding** hour
`(T-1h, T]`. For an ETA `t`, the hour the truck is in is the record at `ceil_to_hour(t)`.
Wind values are instantaneous at `T`; we use the same record for consistency (at most 1 hour
off, well within forecast uncertainty).

If `ceil_to_hour(t)` is outside the returned range, the checkpoint gets `forecast = None` and
risk `UNKNOWN`.

### 6.4 Risk classification

```python
class Level(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

# Ordered (lower_bound, level) pairs; a value takes the highest level whose bound it meets.
WIND_MPH   = [(55, NO_TRAVEL), (45, SEVERE), (35, HIGH), (25, MODERATE)]   # >= bound
RAIN_IN_HR = [(0.50, SEVERE), (0.25, HIGH), (0.10, MODERATE)]               # >= bound
SNOW_IN_HR = [(2.0, SEVERE), (1.0, HIGH), (0.5, MODERATE)]                  # >= bound
RAIN_NO_TRAVEL_ABOVE = 1.00                                                 # strictly >
SNOW_NO_TRAVEL_ABOVE = 3.0                                                  # strictly >
```

```python
CONDITION_ORDER = ("wind", "rain", "snow")   # tie-break for the reported driver

def classify(fc: Forecast, load_lb: int) -> RiskResult:
    wind = fc.gust_mph                         # thresholds apply to gusts (PRD §7.4)
    wind_base = band(wind, WIND_MPH)
    wind_adj, load_rule = apply_load_rules(wind, wind_base, load_lb)
    rain = band_with_strict_top(fc.rain_in_hr, RAIN_IN_HR, RAIN_NO_TRAVEL_ABOVE)
    snow = band_with_strict_top(fc.snow_in_hr, SNOW_IN_HR, SNOW_NO_TRAVEL_ABOVE)
    levels = {"wind": wind_adj, "rain": rain, "snow": snow}
    level = max(levels.values())
    driver = next(k for k in CONDITION_ORDER if levels[k] == level)
    return RiskResult(level, driver, wind_base, wind_adj, rain, snow, load_rule)
```

```python
def apply_load_rules(wind, base, load_lb):
    if wind >= 55:                       return NO_TRAVEL, None          # any load
    if 45 <= wind < 55 and load_lb > 30_000: return NO_TRAVEL, "wind_45_54_over_30k"
    if 35 <= wind < 45 and load_lb > 40_000: return max(base, SEVERE), "wind_35_44_over_40k"
    return base, None
```

- When two conditions give the same level, the reported "driver" is picked in a fixed order
  (wind, rain, snow), so it's deterministic.
- `RiskResult` keeps every intermediate level, so the UI can explain the result without
  recomputing it.
- Thresholds and load rules are data, not branches scattered through the code. Changing a
  number is a one-line change with a failing test to prove it.
- Wind thresholds and load rules use **gusts** (`wind_gusts_10m`). Sustained wind
  (`wind_speed_10m`) is carried through to the response for display only and never reaches
  `classify`. This is a product decision, not a setting, so there is one behaviour to test.

### 6.5 Route metrics

```python
@dataclass(frozen=True)
class RouteMetrics:
    miles_by_level: dict[Level | Literal["UNKNOWN"], float]
    avg_risk: float | None          # distance-weighted, UNKNOWN excluded
    worst: Level | None
    worst_at_mile: float | None
    drivable: bool                  # no NO_TRAVEL miles
    unknown_miles: float
```

### 6.6 Ranking and recommendation

Sort key per route:

```python
(
    round(no_travel_miles),
    round(severe_miles),
    round(high_miles),
    quantize(avg_risk, step=RISK_AVG_TOLERANCE),   # default 0.05
    duration_s,
)
```

- Quantising average risk to a step is the tolerance from PRD §7.6. It is stable and
  transitive, unlike "within ε of each other" comparisons, which can give inconsistent orders.
- `recommended = ranked[0]` if it is drivable; otherwise `None` with reason
  `no_drivable_route`.
- **Reason:** compare `ranked[0]` with `ranked[1]` key by key; the first key that differs
  becomes the sentence, e.g. *"Fewest severe miles (0 vs 38)"* or *"Same risk, 25 min
  faster"*. The template lives on the backend so the reason is tested with the ranking.
- Routes with a lot of Unknown miles (> 20% of length) get a warning; Unknown never improves a
  route's ranking because it is excluded from averages rather than treated as Low.

## 7. API

DRF, JSON, versioned under `/api/v1`. Schema published with `drf-spectacular`; frontend types
generated from it with `openapi-typescript`, so the contract can't drift silently.

### 7.1 `GET /api/v1/geocode/suggest?q=…`

Proxies HERE autosuggest (hides the key, applies throttling, caches by query for 7 days).
Returns up to five `[{label, lat, lon, tz}]`, where `tz` is the IANA zone or null. Queries are
trimmed, lower-cased and whitespace-collapsed before the lookup and the cache key, so "Dallas"
and " dallas " share an entry. Under 3 characters returns `[]` without calling HERE; over 100
is `invalid_input`. The client debounces input by 300 ms. Each miss is a metered HERE call
(§5.1), hence the long cache, the three-character minimum and the debounce; once the month's
budget is spent the endpoint answers 503 `quota_reached`.

### 7.2 `POST /api/v1/plans`

Computes a plan and saves it as a trip owned by the caller (user or guest, §3.2). The
response is the trip snapshot. The client sends an `Idempotency-Key` header (a UUID per form
submission); a repeat with the same key returns the trip already created instead of a second
one.

Request:

```json
{
  "origin": {"lat": 32.7767, "lon": -96.7970, "label": "Dallas, TX"},
  "destination": {"lat": 39.7392, "lon": -104.9903, "label": "Denver, CO"},
  "departure": "2026-10-12T06:00:00-05:00",
  "load_lb": 42000,
  "interval_mi": 25,
  "hos": {
    "enabled": true,
    "cycle": "70h_8d",
    "drive_left_h": 11,
    "window_left_h": 14,
    "until_break_h": 8,
    "cycle_left_h": 52.5
  }
}
```

Validation: `interval_mi ∈ {10,25,50}`; `1 ≤ load_lb ≤ 80000`; departure within
`[now - 15 min, now + 7 days]`; origin ≠ destination (> 1 mile apart).
`hos` is optional and defaults to `{"enabled": false}`. When enabled, the four clocks are
required, in hours with up to 2 decimals (converted to integer seconds on the server), within
`drive ≤ 11`, `window ≤ 14`, `break ≤ 8`, `cycle ≤ 70` (or `≤ 60` for `60h_7d`), and
`drive_left_h ≤ min(window_left_h, cycle_left_h)`.

Response (abridged):

```json
{
  "trip_id": "6f1c2a4e-…",
  "generated_at": "2026-10-11T14:02:11Z",
  "rules_version": "1.0.0",
  "stale": false,
  "settings": {"wind_basis": "gust", "avg_risk_tolerance": 0.05, "hos_enabled": true},
  "recommended_route_id": "r1",
  "recommendation_reason": "Fewest severe miles (0 vs 38)",
  "warnings": [],
  "routes": [
    {
      "id": "r1",
      "rank": 1,
      "geometry": "<encoded polyline, precision 5>",
      "distance_mi": 794.2,
      "duration_s": 45120,
      "trip_duration_s": 82920,
      "departure": "2026-10-12T11:00:00Z",
      "arrival": "2026-10-13T10:02:00Z",
      "hos_stops": [
        {"kind": "break", "reason": "break", "mile": 512.4,
         "lat": 37.42, "lon": -103.51,
         "start": "2026-10-12T19:00:00Z", "duration_s": 1800},
        {"kind": "rest", "reason": "drive_limit", "mile": 690.8,
         "lat": 38.83, "lon": -104.70,
         "start": "2026-10-12T22:30:00Z", "duration_s": 36000}
      ],
      "metrics": {
        "miles_by_level": {"LOW": 640.1, "MODERATE": 110.0, "HIGH": 44.1,
                           "SEVERE": 0, "NO_TRAVEL": 0, "UNKNOWN": 0},
        "avg_risk": 0.25, "worst": "HIGH", "worst_at_mile": 512.5, "drivable": true
      },
      "checkpoints": [
        {
          "mile": 25.0, "owned_mi": 25.0, "lat": 33.05, "lon": -97.10,
          "eta": "2026-10-12T11:24:00Z",
          "forecast": {"valid_hour": "2026-10-12T12:00:00Z", "wind_mph": 18.2,
                       "gust_mph": 31.0, "rain_in_hr": 0.02, "snow_in_hr": 0.0,
                       "weather_code": 3},
          "risk": {"level": "MODERATE", "driver": "wind",
                   "wind": "MODERATE", "wind_adjusted": "MODERATE",
                   "rain": "LOW", "snow": "LOW", "load_rule": null}
        }
      ]
    }
  ],
  "corridor": {"bbox": [-105.2, 32.5, -96.6, 40.0]}
}
```

- Geometry is an encoded polyline (re-encoded from HERE's format as standard precision-5),
  about 5–10× smaller than GeoJSON coordinates.
- Times are UTC on the wire; the client formats them in the origin's time zone (sent as
  `origin.tz` from the geocoder, or derived client-side).
- Errors use one shape: `{"error": {"code": "routing_unavailable", "message": "…"}}` with
  codes `invalid_input`, `no_route`, `routing_unavailable`, `weather_unavailable`,
  `rate_limited`. Validation errors add `"fields": {"hos.drive_left_h": ["…"]}`, with nested
  fields named by dotted path. Provider messages go to the logs, not the client.
- Also in the response: `demo` (fake providers), `forecast_as_of` (when
  the oldest forecast used was fetched, for the stale banner), `reason_code` (the ranking
  criterion that decided, for the UI to key on), `inputs` (the request as understood, so a
  trip page can show the form), and per route `name` ("Route A"), `label` ("via Amarillo"),
  `eta_estimated` and warnings' `route_id`. Route ids and letters follow provider order
  (fastest first), so they don't change when the ranking does.
- Departure must carry a UTC offset; a bare local time is rejected as ambiguous. With
  `hos.enabled` false, any clock values sent are ignored rather than validated.

### 7.3 `GET /api/v1/trips/{trip_id}/heatmap`

Fetched by the client as soon as the plan arrives, so routes show first. The first request
computes the grid from the trip's stored routes and load, saves it as `TripHeatmap` and returns
it; later requests read the stored copy, so a reopened trip shows the heatmap exactly as it was.
Two simultaneous first requests are safe: the second insert hits the one-to-one primary key and
falls back to reading the saved row. Access rules are the same as for the trip.

Response:

```json
{
  "start_hour": "2026-10-11T14:00:00Z",
  "hours": 49,
  "cell_deg": 0.25,
  "points": [[-97.00, 32.75], [-96.75, 32.75], …],
  "risk": [[0,0,1,1,2, …49 values], …],
  "metrics": {"wind": [[…]], "rain": [[…]], "snow": [[…]]}
}
```

`risk[i][h]` is the composite level (0–4) at point `i`, hour `h`, for the trip's load, or
`null` where there's no forecast (Unknown, never Low). Hours count from when the grid is
computed (PRD A10): hour 0 is the hour in progress, and like a checkpoint whose ETA falls in it,
it reads the record stamped at the end of that hour (`start_hour`, §6.3). The response also
carries `stale` and `forecast_as_of`, as the plan does. With
`?include=metrics` (the P1 metric switcher) it adds `metrics`: each condition's level per
point and hour, indexed like `risk`: wind (gusts after the load rules), rain and snow. These
are the levels a checkpoint's rating shows for each condition, from the same `classify` call,
so the rules stay on the server (§19) and the map agrees with the checkpoint table whichever
condition it shows. Levels rather than raw values also keep one colour scale and legend. They
are computed and kept with the grid on the first request, whether asked for or not, so a later
`?include=metrics` reads the same copy (for the demo trip: 3.2 KB gzipped without, 5.7 KB
with). Size for
~600 points × 49 hours of single-digit integers is about 60 KB raw, under 15 KB gzipped.

### 7.4 Trips

All trip endpoints resolve the owner from the session (user or guest) and go through
`planner/access.py` (§3.2). A trip the caller can't see is a 404, never a 403, so ids can't be
probed.

| Method and path | Who | Does |
|---|---|---|
| `GET /api/v1/trips?saved=&q=&cursor=` | owner | Trip summaries (name, places, departure, load, the recommended route and its worst level), newest first, cursor-paginated (20). `q` matches name, origin or destination. Guests get their last 20 and no further pages. |
| `GET /api/v1/trips/{id}` | owner, or anyone if shared | Full snapshot in the same shape as the plan response, plus `name`, `saved`, `shared`, `created_at`, `is_owner`, `replanned_from` |
| `PATCH /api/v1/trips/{id}` | owner | Update any of `name`, `saved` (users only; guests get 403 `account_required`), `shared`; returns the trip |
| `DELETE /api/v1/trips/{id}` | owner | Delete trip, routes and heatmap; 204 |
| `POST /api/v1/trips/{id}/replan` | owner, or anyone if shared | New trip with the same inputs and current weather; departure moved to now if in the past. Owned by the caller, with `replanned_from` set; returns it like `GET`. Takes `Idempotency-Key` and the plan throttles, as `POST /plans` does. |

### 7.5 Accounts

| Method and path | Does |
|---|---|
| `/api/auth/browser/v1/auth/signup`, `…/login`, `…/session` (GET, DELETE) | allauth headless: sign up, log in, current session, log out |
| `GET /api/v1/me` | `{ "user": {"email": …} | null, "guest": bool, "recent_trip_count": n }` for the header |
| `DELETE /api/v1/me` | Delete account and all its trips; requires `{"password": …}` (wrong: 400, nothing deleted); ends the session; 204 |

The client gets the CSRF token from the `csrftoken` cookie and sends it as `X-CSRFToken` on
every unsafe request. DRF's `SessionAuthentication` enforces it. `GET /api/v1/me` sets the
cookie (the app calls it first), and a request Django refuses for CSRF gets the API's JSON
error with code `csrf_failed` rather than Django's HTML page.

allauth's endpoints answer in allauth's own shape (`{status, data, meta}`, or `{status,
errors: [{code, message, param}]}`), which the client reads separately from the API's
`{error}` shape. Codes the UI uses: `email_taken`, `email_password_mismatch`,
`too_many_login_attempts` and the password validators' (`password_too_short`, …).

## 8. Corridor grid

1. Take the union of all route polylines, simplified (Douglas–Peucker, ~1 km tolerance).
2. Buffer by 30 miles (on a local equirectangular projection; accurate enough at this scale,
   and no GEOS/PostGIS dependency). It was 40 until 2026-10-14; 30 keeps a regional trip's
   cold heatmap inside one minute of Open-Meteo's free tier (§5.2): Dallas → Denver is 453
   points at 30 mi and was 603 at 40.
3. Generate points on a **fixed global lattice** (default 0.25°) that fall inside the buffer.
   A fixed lattice means two plans in the same region share grid points, so the forecast cache
   hits.
4. **Point cap:** if more than 500 points, step the lattice up (0.25° → 0.5° → 1°) until under
   the cap, which keeps a cold heatmap under the 540-a-minute budget (§5.2). Demo data costs
   nothing, so its cap stays at 700 and the demo trip keeps the 0.25° lattice.
5. Batch-fetch hourly forecasts for hours 0–48 (cache-first, §9), classify every point-hour with
   `domain.risk.classify` using the plan's load, and return.

The same classifier runs for checkpoints and the heatmap, so the map can never disagree
with the route summary.

## 9. Caching, batching and quotas

| Key | Value | TTL |
|---|---|---|
| `v{rules}:fc1:{lat2}:{lon2}:{fetch_hour}` | 10 days of hourly forecast for a snapped point | fresh 3 h, then kept 3 h more as a stale fallback |
| `v{rules}:rt1:{hash(origin,dest,via,load,departure_hour)}` | the three distinct routes (geometry as a precision-6 polyline) | 6 h |
| `geo1:{hash(q)}` | autosuggest results | 7 days |

- **Snapping:** checkpoint forecasts are fetched at the point snapped to the heatmap's 0.25°
  lattice (≈ 17 mi), so a trip's heatmap reuses them and nearby plans share entries. It was
  0.1° until 2026-10-14; the coarser lattice cuts a 10 mi Dallas → Denver plan from 217
  Open-Meteo calls to 131 (§5.2), at the cost of some of HRRR's 3 km detail. The checkpoint
  keeps its true position for display.
- **Freshness:** an entry stays fresh for 3 hours after its fetch hour, since the US models
  behind `best_match` update every 1 to 6 hours; lookups read this hour's key and the two
  before. `forecast_as_of` in responses says how old the data is.
- **Batching:** missing points are fetched in batches of ≤ 100 locations per Open-Meteo request,
  run in parallel on a bounded thread pool (8 workers) using `httpx` with timeouts (connect 3 s,
  read 10 s) and one retry with jitter on 5xx or timeout. Each batch first reserves its weight
  in the rate budget (§5.2); a busy budget keeps the batches that came back and raises
  `weather_busy`, so a retry fetches only the rest.
- **One forecast window per point:** each cached entry covers now − 1 h to now + 7 days + trip
  length, so checkpoints at any ETA and the heatmap's 0–48 h share the same cache entry.
- Cache backend: Redis via `django-redis`; `LocMemCache` fallback for local dev without
  Docker.
- **Routes are cached for real providers only.** Every HERE call is metered (§5.1), so a
  repeat of the same trip in the same departure hour, including a replan, costs no routing
  call. The fakes are free, and their geometry isn't on the polyline grid the cache stores.
- **Quotas:** HERE calls are counted against a monthly budget in Postgres, not in the cache
  (§5.1): Redis may evict a key, and a lost counter would restart the month.

## 10. Frontend design

### 10.1 Libraries

| Concern | Choice | Why |
|---|---|---|
| Build | Vite + React 18 + TypeScript (strict) | Fast dev, simple static deploy |
| Server state | TanStack Query | Caching, loading/error states, plan → heatmap dependent query |
| Map | MapLibre GL JS via `react-map-gl/maplibre` | WebGL, handles thousands of features at 60 fps, open source, no token |
| Basemap | OpenFreeMap or MapTiler free vector tiles, muted style | Low-contrast basemap so risk colours stand out |
| Forms | React Hook Form + Zod | Same validation rules as the API, typed |
| Styling | Tailwind CSS | Speed, consistency |
| Tests | Vitest + React Testing Library; one Playwright smoke test | |

Leaflet was considered and rejected: its DOM/Canvas rendering struggles with hundreds of markers
plus a 49-frame heatmap, and smooth scrubbing is 35% of the grade.

### 10.2 State

- Server state (plan, heatmap, session, trips) in TanStack Query. Logging in or out
  invalidates the session and trips queries.
- Routing with react-router: `/` planner, `/trips/:id` trip page (same planner view, read from
  the snapshot), `/trips` My trips, `/login`, `/signup`, `/account`. `/trips` and `/account`
  redirect guests to `/login?next=…`.
- UI state (selected route, hovered checkpoint, slider hour, layer toggles) in a small
  `useReducer` store in a context, or Zustand if prop drilling grows. No Redux.
- The slider hour lives in its own context so that dragging re-renders only the slider and
  the heatmap layer, not the routes panel.

### 10.3 Map layers (bottom to top)

1. **Heatmap** (`heatmap` layer on a GeoJSON source of grid points).
2. **Routes, unselected:** `line` layer, grey, 4 px.
3. **Selected route segments** coloured by checkpoint risk (P1-4); otherwise a solid accent
   colour, 6 px, with a casing.
4. **Checkpoints:** a single `circle` layer, colour from a `match` on `level`, radius scaled by
   zoom. Hover and selection via `feature-state`, no re-render of the source.
5. **HOS stops** (only when HOS is on): a marker per stop with distinct icons for break, rest
   and restart. A route has only a handful of stops, so markers cost nothing, and each is a
   button that can be reached and opened from the keyboard. Its popup gives start, end, length
   and reason.
6. **Popups:** one React popup for the hovered or clicked checkpoint or stop.

All routes and checkpoints go in **one GeoJSON source each**, built once per plan with
`useMemo`. Selecting a route changes a filter or paint expression, not the data.

### 10.4 Heatmap scrubbing

Each grid point is a GeoJSON feature with flat properties `h0 … h48` holding its risk level.
(Flat properties because nested arrays in GeoJSON properties are serialised to strings by
MapLibre's tiler and can't be indexed by expressions.)

On slider change:

```ts
map.setPaintProperty("corridor-heat", "heatmap-weight",
  ["/", ["+", ["coalesce", ["get", `h${hour}`], -1], 1], 5]);
```

Each level gets a fifth of the weight scale, Low included (0.2, so Low shows soft green as on
the checkpoints, rather than nothing). An hour with no forecast has no property and weighs 0, so
Unknown is left uncoloured rather than drawn as Low.

That is one paint update with no data upload and no React re-render of the map tree. It is
throttled with `requestAnimationFrame`, so dragging is capped at one update per frame.
Play mode steps one hour every 250 ms.

- The grid is uniform, so the heatmap's density effect is even and the colour follows the
  weight (risk), not point clustering. `heatmap-radius` grows ×2 per zoom level, keeping the
  kernel at 0.6 grid steps, so cells merge without gaps at every zoom level.
  `heatmap-intensity` is set so the summed kernels give a density equal to the weight (within
  ±4% on and between cells, checked numerically), allowing for Mercator's taller rows at the
  grid's mean latitude. `heatmap-color` steps on density at the midpoints between levels, so
  each band is exactly one of the checkpoints' colours, with a legend.
- **Truck position.** While scrubbing, each route shows its truck where the plan puts it at
  the slider's hour: the mile is interpolated by time between the checkpoints' ETAs, with
  each HOS stop as two points at one mile (start and end) so the truck stands still through
  it, then placed on the line as the backend places checkpoints (line length scaled to the
  reported miles). At a checkpoint's ETA the truck is on that checkpoint. It is hidden before
  departure and after arrival. Three DOM markers moved by props: no data upload.
- **Fallback if the blurred look misleads at high zoom:** switch the layer to a `fill` layer
  of grid cells with the same `["get", "h<hour>"]` expression. Same data, same scrubbing method.

### 10.5 Components

```
<App>
  <Header/>                       # Recent trips menu (guest) or My trips + account menu (user)
  <TripForm/>                     # RHF + Zod, autosuggest comboboxes, interval segmented control
    <HosFields/>                  # collapsed until the HOS toggle is on; cycle select + 4 ELD clocks
  <RoutesPanel>                   # ranked cards; recommendation badge + reason; Not drivable tag
    <RouteCard/> <RiskBar/>       # stacked bar of miles by level
  </RoutesPanel>
  <MapView>
    <HeatmapLayer/> <RoutesLayer/> <CheckpointsLayer/> <CheckpointPopup/> <Legend/>
  </MapView>
  <HeatmapSlider/>                # 0–48, clock labels, play/pause, keyboard arrows
</App>
```

### 10.6 Accessibility and colour

Risk ramp (changed 2026-10-14 at the owner's request): soft green → yellow → amber → red, then
near-black for No Travel, the traffic-light order drivers read at a glance. It replaces
ColorBrewer's YlOrRd. Red and green alone are hard to tell apart with the commonest colour
blindness, so the steps also differ in lightness (light green and yellow, mid amber, dark red,
near-black), and every colour is paired with a text label in cards, popups and the legend.
Unknown stays a neutral grey outside the scale. Slider is a native `<input type="range">` with `aria-valuetext` like "+14 h,
Saturday 20:00".

## 11. Error handling

| Situation | Backend | UI |
|---|---|---|
| Geocoder has no match | empty list | "No matches" in the dropdown |
| No route between points | 422 `no_route` | Inline error on the form |
| Fewer than 3 distinct routes | 200 + `warnings` | Note above the route list |
| Routing provider down / timeout | 502 `routing_unavailable` | Error state with retry |
| HERE monthly budget spent | 503 `quota_reached` | "Live routing is paused until next month", no retry; place search says the same in its dropdown |
| Weather down for some points | 200, those checkpoints `UNKNOWN`, warning | Unknown shown in grey, note on route |
| Weather down, stale cache available | 200 with `stale: true` | "Forecast from N h ago" banner |
| Weather down entirely | 502 `weather_unavailable` | Error with retry; no risk shown as Low |
| Weather rate limit reached, no stale copy | 503 `weather_busy` with `Retry-After`; what was fetched is kept | Plan: "The weather service is busy", retry held for Retry-After. Heatmap: retried automatically up to 3 times when the wait is ≤ 2 min. Never shown as Unknown |
| Heatmap fails | heatmap 502 | Routes stay usable; heatmap toggle shows error |
| Rate limited | 429 `rate_limited` | "Too many requests, try again in a minute" |

Rule: **never show a missing value as safe.**

## 12. Security

- HERE key only in backend env vars; Open-Meteo needs no key.
- DRF throttling: `plans` 10/min per guest session and IP, 30/min per signed-in user;
  `geocode` 60/min; `heatmap` 20/min; `trips` (reading lists and trips) 120/min; `delete_account` 5/min per user (it checks a password); login attempts limited by allauth. Until guest sessions
  exist, guests are counted by IP. The client IP comes from `X-Forwarded-For` only
  as far as `NUM_PROXIES` trusted proxies allow (default 0), so a client can't choose its own
  throttle key.
- Sessions: httpOnly, Secure, `SameSite=Lax` cookies; CSRF enforced on unsafe methods. The
  CSRF cookie is Secure and Lax but not httpOnly, because the client reads it into
  `X-CSRFToken` (§7.5);
  `CSRF_TRUSTED_ORIGINS` set to the site origin. Same-origin deployment through the frontend's
  `/api` proxy, so no CORS (§3.2).
- Passwords hashed with Argon2; Django password validators on; account deletion requires the
  password.
- **Object-level access** only through `planner/access.py`; 404 for anything not visible.
  Tests cover every combination of caller (owner, other user, guest, other guest, anonymous)
  and trip state (private, shared).
- `DEBUG=False`, strict `ALLOWED_HOSTS`, HTTPS only, standard Django security middleware.
  Production redirects HTTP to HTTPS (except `/healthz` and `/readyz`, which the host calls
  internally), trusts `X-Forwarded-Proto` from the host's proxy, and sends HSTS for a year
  without `includeSubDomains` or preload, since the app runs on a domain we don't own
  outright. `manage.py check --deploy` passes, with the two warnings about those flags
  silenced on purpose.
- Input sizes bounded by validation (no free-form geometry accepted from clients).

## 13. Testing

| Layer | What | How |
|---|---|---|
| `domain/risk` | Every boundary in the risk table, either side (e.g. wind 24.99/25/34.99/35 …; rain 0.25, 0.50, 1.00, 1.0001), every load rule edge (30,000 vs 30,001; 40,000 vs 40,001), condition precedence, deterministic driver | `pytest.mark.parametrize` tables written straight from the PRD table |
| `domain/sampling` | Spacing, final checkpoint, owned miles sum to length (property test with Hypothesis on random polylines) | pytest + Hypothesis |
| `domain/eta` | Span interpolation, reverse lookup (drive time → mile) | pytest |
| `domain/hos` | Each limit triggering alone (break at 8 h, rest at 11 h, rest at 14 h window when starting mid-shift, restart when cycle runs out); coinciding limits produce one longest stop; break pushing the window to zero; clocks starting at 0; trip ending exactly on a limit adds no stop; `clock_offset` at and either side of a stop; multi-day trips with several rests and a restart | pytest tables + Hypothesis: stops never overlap, no driving stretch breaks any limit, `clock_offset` is monotonic |
| `domain/ranking` | Each criterion decides when earlier ones tie; tolerance quantisation; no-drivable case; reason text | pytest |
| `providers` | Request building and response parsing from recorded fixtures; unit conversion | pytest + `respx` |
| `services` + `api` | End-to-end plan with fake providers; validation errors; error codes | pytest-django + DRF test client |
| Frontend | Form validation, route card rendering, slider → paint expression call | Vitest + RTL with a mocked map |
| `models` | Every database constraint rejects bad rows (`IntegrityError` tests); purge deletes exactly the right trips | pytest-django on Postgres |
| `access` + trips API | Access matrix: owner / other user / guest / other guest / anonymous × private / shared, for every trip endpoint; guest claim on login and sign-up; list endpoint query count | pytest-django |
| Smoke | Load app, plan a fixture trip, see 3 routes and scrub the slider; sign up and see the trip in My trips | Playwright against fake-provider backend |

The fake providers (`providers/fakes.py`) also give a **demo mode**: a scripted storm that
makes the walkthrough repeatable whatever the real weather is on recording day. The UI marks
clearly when demo data is in use.

CI: GitHub Actions running ruff, mypy (domain package strict), pytest, eslint, tsc, vitest.

## 14. Observability

Structured JSON logs with a request id; one log line per plan with provider latencies, cache
hit ratio, number of checkpoints and grid points. Sentry (free tier) on both apps if time
allows.

## 15. Deployment

- **Backend:** Docker image (gunicorn, 3 workers × 4 threads) on Render or Fly.io, with managed
  Postgres and Redis. Migrations run as a release step before new instances take traffic.
  `purge_trips` runs daily as a scheduled job. Use an always-on instance for the review window. Free tiers that sleep add a cold start
  of up to a minute, which a reviewer would feel immediately (PRD §8).
- **Frontend:** static build on Vercel, with a rewrite from `/api/*` to the Django service so
  the app and API share one origin (§3.2).
- **Local:** `docker compose up` brings up api, postgres, redis and web (Vite proxies `/api`
  the same way); `make test` runs both suites. Postgres locally too, not SQLite, so constraints
  and JSON behave as in production.
- Secrets: `HERE_API_KEY`, `DJANGO_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`,
  `CSRF_TRUSTED_ORIGINS`.

## 16. Delivery plan

| Phase | Output | Exit check |
|---|---|---|
| 1. Domain core | `risk`, `sampling`, `eta`, `metrics`, `ranking` + full tests | All boundary tests green |
| 2. Providers | HERE routing/autosuggest, Open-Meteo, fakes, caching | Real Dallas → Denver plan in a shell |
| 3. API | `/plans`, `/trips/{id}/heatmap`, `/geocode/suggest`, OpenAPI; trips saved for guests | API tests green; schema generated |
| 3b. Accounts and trips | Sign-up/login, guest claim, My trips, sharing, purge | Access-matrix tests green |
| 4. Frontend core | Form, routes panel, map with routes + checkpoints + popups | Plan a trip end to end locally |
| 5. Heatmap | Corridor grid endpoint, heatmap layer, slider, play | 60 fps scrubbing in Chrome performance panel |
| 6. Hardening | Error states, accessibility, demo mode, P1 items as time allows | Playwright smoke green |
| 7. Ship | Deploy, README, Loom | Hosted URL works from a clean browser |

Phases 1 to 5 are the graded core; P1 features start only after phase 6 is done.

## 17. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Routing provider gives < 3 distinct routes | Fails a headline requirement | Over-request + via-point alternatives + dedupe; honest warning |
| Open-Meteo daily quota | Demo breaks during review | Snapping + caching + point cap; recorded-fixture demo mode; paid key is a config change |
| HOS toggle off by default | ETAs on long trips ignore required stops | Toggle and its label explain the difference; HOS model documented with its simplifications |
| Forecast differs from reality | "Wrong" recommendation on video | Demo mode for the walkthrough; real mode for the hosted app |
| Heatmap looks smeared or misleading | Hurts the 35% UI score | Uniform lattice, zoom-scaled radius; fill-grid fallback |
| Cold start on free hosting | Bad first impression | Always-on instance for the review window |

## 18. Engineering quality

How the design covers the usual quality attributes. Items marked **(added)** were not explicit
in earlier drafts of this RFC; they are now part of the design and have tasks in
[tasks.md](./tasks.md).

### 18.1 Architecture and maintainability

- **Ports and adapters.** `domain/` is pure (no Django, no I/O); `providers/` implement
  protocols from `providers/base.py`; `services/` orchestrate; `api/` only translates HTTP.
  Dependencies point inward, so the rules can be read, tested and changed without touching
  the web layer, and a provider can be swapped without touching the rules.
- **One source of truth for the rules.** Risk, load rules, HOS and ranking exist once, on the
  server. Checkpoints and the heatmap use the same `classify()`, so the map can't disagree
  with the route cards.
- **Contract first.** The OpenAPI schema is generated from the serializers, and the frontend
  types are generated from the schema. A breaking change fails `tsc` in CI instead of failing
  in the browser.
- **Rules as data.** Thresholds are tables, not scattered `if`s.
- **Tooling:** ruff (lint and format), mypy strict on `domain/` and `providers/`, eslint,
  prettier and strict `tsc`, all run by pre-commit and CI. Lock files for both apps (`uv.lock`,
  `package-lock.json`), pinned Docker base image.
- **Decisions are written down:** PRD for product interpretations, this RFC for design, short
  ADR notes in `docs/adr/` for anything that changes later. Conventional Commits, one task id
  per branch.
- **Deliberately not built (YAGNI):** no task queue, organisations or roles, social login,
  email delivery, microservices or Kubernetes. Each has a stated trigger for adding it (§3, §19).

### 18.2 Scalability

- **Stateless API.** No in-process state between requests, except the circuit breaker, which
  is per process by design. Shared state is in Redis and Postgres (sessions included), so the
  API scales horizontally by adding instances.
- **Database load is small and indexed.** One plan writes 1 trip + 3 route rows (+1 heatmap row)
  in a single transaction; JSON columns are compressed by Postgres automatically. Lists use the
  `(owner, created_at)` indexes and defer heavy columns (§3.1). Persistent connections
  (`CONN_MAX_AGE` with health checks) avoid a connection per request; a pooler such as
  PgBouncer is the next step if instance count grows.
- **Bounded cost per request.** At most 3 routes; the checkpoint count is set by route length
  and the minimum interval (10 mi); heatmap points are capped (500, §8); outbound
  concurrency is a fixed pool of 8 per request. One request can't fan out without limit.
- **More users, more cache hits.** Snapping checkpoints and grid points to fixed lattices
  (§9) means users planning in the same region share forecast entries, so upstream calls grow
  slower than traffic.
- **Single-flight on cache misses (added).** When several requests miss the same forecast key
  at once, one of them takes a short Redis lock (`SET NX`, 10 s TTL) and fetches; the others
  wait briefly for the value instead of all calling Open-Meteo (no cache stampede).
- **Frontend cost doesn't grow with the data.** GPU layers for routes, checkpoints and the
  heatmap; a slider move is one paint-property change regardless of grid size; payload budget
  under 100 KB gzipped for plan + heatmap.
- **Scale-up path,** in order: more API instances → commercial Open-Meteo key → move the
  heatmap to a background job with polling → precompute popular corridors. None is needed
  for this project.

### 18.3 Reliability

- **Timeouts everywhere:** 3 s connect, 10 s read on every outbound call. Gunicorn has its
  own worker timeout, so a hung provider can't hold a worker indefinitely.
- **Retries** only on idempotent GETs, once, with jitter, only on timeouts and 5xx.
- **Circuit breaker per provider (added).** After 5 consecutive failures, calls to that
  provider fail fast for 30 s, so a provider outage gives a quick, clear error instead of
  every request waiting for timeouts.
- **Stale-while-revalidate for forecasts (added).** Forecast entries are kept for 3 h past their
  freshness TTL. If Open-Meteo is down, a stale entry is used and the response carries
  `"stale": true` with the forecast age; the UI shows "Forecast from 2 h ago".
- **Degrade, don't fail.** The heatmap is a separate request, so if it fails the routes still
  work. Missing weather is `UNKNOWN`, never Low (§11).
- **Health endpoints (added).** `/healthz` (process alive) and `/readyz` (Redis reachable,
  settings valid) for the host's checks and zero-downtime deploys.
- **Safe retries from the client.** `POST /plans` creates a trip, so it takes an
  `Idempotency-Key`: a retried submission returns the same trip instead of creating a duplicate
  (unique column, §7.2).

### 18.4 Data integrity and correctness

We store no user data, so integrity here means the numbers we derive are correct, consistent and
traceable.

- **Database constraints back up the code (added with persistence).** Exactly one owner per
  trip, only signed-in users can save, input ranges, one route per rank, at most one
  recommended route per trip and only if drivable, arrival after departure (§3.1). A bug in a
  serializer can't write an impossible row.
- **All-or-nothing writes.** A trip and its routes are saved in one transaction; claiming guest
  trips on login is one `UPDATE` in a transaction. The heatmap is saved separately, so its
  failure never loses the trip.
- **Snapshots stay readable.** JSON columns carry `snapshot_version`; readers handle every
  version still in the database, and the purge window bounds how many that is.
- **Validate at the boundary, reject instead of coercing.** DRF serializers validate every
  input (§7.2); the frontend mirrors the rules with zod for fast feedback, but the server is the
  authority.
- **Validate provider data too.** Parsers reject malformed responses, and treat `null`/`NaN`
  forecast values as missing (→ `UNKNOWN`). A routing response without geometry or duration is
  an error, not a zero-length route.
- **Units in names and in one module.** Fields carry their unit (`gust_mph`, `rain_in_hr`,
  `duration_s`); conversion only in `domain/units.py`. HOS uses integer seconds, so limit checks
  are exact.
- **Time.** Timezone-aware datetimes only (ruff `DTZ` rules ban naive ones), UTC everywhere
  inside, conversion to local time only for display.
- **Immutability and determinism.** Domain types are frozen dataclasses; domain functions are
  pure, so the same inputs and forecast always give the same plan, which makes bugs reproducible
  from a logged request.
- **Invariants as property tests.** Owned miles add up to the route length; ETAs never decrease
  along a route; no HOS driving stretch exceeds any limit; ranking is a strict total order.
- **Provenance in every response (added).** `rules_version` (bumped whenever thresholds,
  load rules, HOS or ranking change), `generated_at`, and per checkpoint the forecast's
  `valid_hour`, plus `stale` when applicable. Any number on screen can be traced to its inputs.
- **Versioned cache keys (added).** Every key is prefixed with `rules_version` and a payload
  schema version, so a deploy that changes rules or shapes never serves results computed under
  the old ones.

### 18.5 Security

Covered in §12: keys only on the server, throttling, session cookies with CSRF, one-origin
deployment, object-level access checks, input bounds, no client-supplied geometry, security
middleware. Plus dependency audits (`pip-audit`,
`npm audit`) in CI **(added)**.

### 18.6 Observability

Covered in §14. The request id is also sent on outbound provider calls' logs, so one plan
can be followed end to end. Each response includes the request id in an `X-Request-ID`
header, so a user-reported problem can be found in the logs.

### 18.7 Testability

The testing pyramid in §13: most tests on the pure domain (fast, no mocks needed), provider
adapters against recorded fixtures, a thin layer of API tests with fake providers, and one
browser smoke test. The fakes double as demo mode, so the code path used in the walkthrough
is the tested one.

## 19. Alternatives considered

- **Compute risk in the browser.** Would make the heatmap metric switcher trivial, but splits
  the rules across two languages. Rejected: one implementation of the rules, on the server,
  tested once.
- **Async jobs (Celery) with polling.** Rejected for v1 (§3); kept as the scale-up path.
- **PostGIS for corridor buffering.** Overkill for a buffer and a point-in-polygon test on a
  few hundred points; adds hosting complexity.
- **deck.gl for rendering.** Very capable, but MapLibre's built-in layers cover everything we
  need with fewer dependencies.

## 20. Open questions

Resolved 2026-10-14: HERE stays on the **free tier**, with a monthly budget that stops calls at
90% of each service's allowance (§5.1).

Resolved 2026-10-11: risk uses **gusts**; Hours of Service is an **optional toggle, off by
default**, with the 11 h, 14 h, 30 min and 60/70 h rules (§6.2.1); plans are saved as trips for
guests and signed-in users, with session-based accounts (§3.1, §3.2).

Technical:

2. Lattice size for the heatmap (0.25° default): check visually with real data and adjust.
3. Default for the average-risk tolerance (0.05): check it doesn't hide meaningful
   differences on real routes.
4. If the frontend host can't proxy `/api` (e.g. a host without rewrites), fall back to
   serving the built frontend from Django with WhiteNoise, which keeps one origin.
