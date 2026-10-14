# PRD: Weather-Aware Truck Routing

| | |
|---|---|
| **Status** | Draft v1 |
| **Date** | 2026-10-11 |
| **Source** | Spotter "Full Stack Developer — Weather-Aware Truck Routing" assessment brief (2 pages; not kept in the repo) |
| **Stack** | Django (API) + React (web client) |
| **Companion doc** | [RFC-001: Weather-Aware Truck Routing — Technical Design](./RFC-001-weather-aware-routing.md) |

---

## 1. Summary

A web app that helps a truck driver choose the **safest route** between two places by
looking at the weather the truck will actually drive through: the forecast at each point
on the route **at the time the truck is expected to be there**, combined with the truck's
load weight. The app compares three route options, scores each for weather risk, recommends
one, and shows everything on a map with a 0–48 hour weather heatmap along the corridor.

## 2. Problem

Drivers and dispatchers usually choose a route by distance and time, then check the weather
separately, often as a snapshot of *current* conditions at origin and destination. That misses
what matters for a heavy vehicle:

- Weather along the route changes during the trip. A storm 300 miles out may arrive before
  the truck does, or clear by the time it gets there.
- Risk depends on the load. High crosswinds that a loaded trailer can handle may tip a light
  one, and the assessment's rules also make heavy loads riskier in strong wind.
- There is no single number that says "Route B is safer than Route A, and here is why".

## 3. Users

**Primary: the long-haul truck driver** planning a trip before departure, usually on a laptop
or tablet, sometimes on a phone. They want a clear answer ("take this route") with enough detail
to trust it.

**Secondary: the dispatcher** planning a trip for a driver. Same tasks; more likely on a desktop
with a large screen, more likely to compare routes in detail.

**Guests and signed-in users.** Anyone can plan a trip without an account (a guest). Signing
up keeps trip history across devices and lets users save and name trips (§7.9).

**Evaluator (for this assessment):** a Spotter engineer who will judge correctness of the
routing/weather/risk logic (40%), smoothness and performance of the UI, map and heatmap (35%),
code quality (10%), and documentation and walkthrough (5%). Product decisions below lean
toward those weights.

## 4. Goals and non-goals

### Goals

1. Given origin, destination, departure time and load weight, return **3 route options** with
   time-aware weather risk at regular checkpoints.
2. Apply the provided risk and load rules **exactly and transparently**, so a user can see
   why each checkpoint got its rating.
3. **Recommend one route** using the provided priority order, and explain the choice.
4. Show routes, checkpoints, risk, ETAs and summaries on an interactive map.
5. Show a **weather heatmap over the trip corridor** with a **0–48 hour slider** that scrubs
   smoothly.
6. Save every plan as a trip, for guests and signed-in users, so what was recommended can be
   seen again exactly as it was.
7. Ship as a hosted app with a public repo and a 5–10 minute walkthrough video.

### Non-goals

- Building a routing engine (we use a third-party routing API).
- Turn-by-turn navigation, live GPS tracking or re-routing while driving.
- Fleet management, organisations, roles or multi-driver dispatch. Accounts are individual.
- Weather beyond what the rules cover (fog, ice, freezing rain, visibility, temperature) as
  inputs to risk. They can appear as information only.
- Hazmat, bridge-height or other truck restriction modelling beyond what the routing provider
  does by default with the given weight.

The assessment says to *prioritise correctness and clarity over extra features*. Anything not
in P0 below is optional and is built only once P0 is solid.

## 5. Scope

### P0 (must ship)

| # | Capability |
|---|---|
| P0-1 | Trip form: origin and destination with address autocomplete, departure date/time, load weight (lb), sampling interval (10 / 25 / 50 mi) |
| P0-2 | 3 route options from a routing API, truck-aware where the provider supports it |
| P0-3 | Checkpoints every N miles along each route, each with an ETA |
| P0-4 | Hourly forecast at each checkpoint **for its ETA** |
| P0-5 | Per-checkpoint risk using the risk table and load rules, showing which condition drove the rating |
| P0-6 | Route summary: distance, drive time, arrival time, miles at each risk level, average risk, worst risk |
| P0-7 | Recommended route chosen by the stated priority, with a one-line reason |
| P0-8 | Map: all 3 routes, recommended route highlighted, checkpoints coloured by risk with details on hover/click |
| P0-9 | Corridor weather heatmap with a 0–48 h slider that updates without network calls or visible lag |
| P0-10 | Clear handling of failures: no route found, fewer than 3 routes, forecast unavailable, provider errors |
| P0-11 | Hosted app, README, walkthrough video |
| P0-12 | Every plan saved as a trip snapshot with its own link; guests see their recent trips on this device (§7.9) |

### P1 (should ship if time allows)

| # | Capability |
|---|---|
| P1-1 | Hours-of-Service-aware ETAs (11 h driving, 14 h on-duty window, 30 min break, 60/70 h weekly cycle; see §7.3.1), as an optional toggle, **off by default**. Without it, ETAs on trips over ~11 h are wrong and so is the weather looked up for them. |
| P1-2 | Heatmap metric switcher: composite risk / wind / rain / snow |
| P1-3 | On the heatmap slider, show where the truck would be on each route at that hour |
| P1-4 | Route segments coloured by risk (not just checkpoint dots) |
| P1-5 | Accounts: sign up, log in, log out, delete account; guest trips move into the account on sign-in (§7.9) |
| P1-6 | My trips: history, save and name, rename, delete, re-plan with current weather (§7.9) |
| P1-7 | Share a trip with a read-only link, revocable (§7.9) |

### P2 (stretch, probably not in this assessment)

- "Earliest safe departure": scan departures over the next 48 h and suggest one that avoids
  No Travel / Severe miles.
- Mobile-first layout tuned for in-cab use.
- Google sign-in; email verification and password reset by email.
- Profile defaults (usual load weight, HOS cycle).

## 6. User stories

1. *As a driver, I enter where I'm going, when I leave and how heavy my load is, and get three
   routes ranked by safety,* so I don't have to check the weather myself.
2. *As a driver, I see which route the app recommends and why in one sentence* (e.g. "0 severe
   miles vs 42 on Route B; 35 min longer").
3. *As a driver, I click a checkpoint and see the expected time I'll be there, the forecast wind,
   gusts, rain and snow, and which rule produced its risk level,* so I can judge for myself.
4. *As a driver with a heavy load, I see when my weight made a checkpoint worse* (e.g. "High →
   Severe: wind 38 mph with 42,000 lb load").
5. *As a dispatcher, I drag the heatmap slider through the next 48 hours* to see a storm move
   across the corridor and decide whether to delay departure.
6. *As a driver, I'm told clearly when a route is not drivable* (any No Travel checkpoint) and
   when no route is safe at my departure time.
7. *As a driver on a multi-day trip, I turn on Hours of Service and enter the clocks from my
   ELD,* so ETAs include my required breaks and rests, and the weather is checked for when I'll
   really be on each stretch of road.
8. *As a guest, I can plan trips straight away without signing up,* and come back to my recent
   trips on the same device.
9. *As a guest who decides to sign up, I keep the trips I already planned.*
10. *As a signed-in driver, I see all my trips on any device, save the ones I'll repeat, and
    re-plan a saved trip with today's weather in one click.*
11. *As a dispatcher, I send a driver a read-only link to the plan I made,* and can turn the
    link off later.

## 7. Functional requirements

### 7.1 Inputs

| Field | Rules |
|---|---|
| Origin, destination | Free text with autocomplete; resolved to coordinates before submit. Must differ. |
| Departure | Local date/time, shown with time zone. Must be no earlier than now (with 15 min grace) and no later than 7 days ahead. Departures more than 48 h out show a "forecast confidence is lower" note. |
| Load weight | Pounds, integer, 1–80,000 (US federal gross weight limit). Default empty, required. |
| Sampling interval | 10, 25 or 50 miles. Default 25. |
| Hours of Service | Optional toggle, off by default. When on, shows the HOS inputs in §7.3.1. |

> **Interpretation:** the brief says "sample weather every 10 / 25 / 50 miles". We read this
> as a user-selectable interval. Finer sampling catches more local weather; coarser sampling
> is faster and cheaper.

### 7.2 Routes

- Return exactly 3 options when the provider has them. If it returns fewer, generate extra
  alternatives (see RFC). If there are still fewer than 3 distinct routes, show what we have
  with a note. Never pad the list with near-duplicates.
- Each route: geometry, distance (mi), drive duration, departure and arrival time.

### 7.3 Checkpoints and ETAs

- A checkpoint at the origin, then every N miles along the route, plus the destination.
- Each checkpoint's ETA comes from the routing provider's travel time to that point
  (traffic-aware for the chosen departure when available). With Hours of Service on, required
  breaks and rests are added (§7.3.1).
- Weather for a checkpoint is the forecast for the hour that contains its ETA.

#### 7.3.1 Hours of Service (optional toggle)

US federal Hours of Service (HOS) rules for property-carrying drivers limit driving time.
When the toggle is on, the app plans the stops the driver must take and moves every later ETA
by that much. When it's off, ETAs are continuous driving time, as a routing API reports them.

**Rules modelled**

| Rule | Limit | What the planner does when it's reached |
|---|---|---|
| Driving limit | 11 h driving after 10 consecutive hours off duty | 10 h rest |
| On-duty window | No driving after the 14th hour since the shift started. Breaks don't pause it. | 10 h rest |
| Break | 30 min break after 8 h of driving without one | 30 min break |
| Weekly cycle | No driving after 70 h on duty in 8 days (or 60 h in 7 days) | 34 h restart |

A 10-hour rest resets the driving limit, the on-duty window and the break clock. A 34-hour
restart resets everything, including the weekly cycle. When two limits are hit at the same
moment, the planner takes the longer stop.

**Inputs** (shown only when the toggle is on). They match the four clocks a driver sees on
their ELD, so they can be copied straight across. Defaults are a fully rested driver.

| Field | Range | Default |
|---|---|---|
| Cycle | 70 h / 8 days or 60 h / 7 days | 70 h / 8 days |
| Drive time available | 0–11 h | 11 h |
| Shift time available | 0–14 h | 14 h |
| Time until break required | 0–8 h | 8 h |
| Cycle time available | 0–70 h (or 0–60 h) | 70 h (or 60 h) |

Drive time available can't exceed shift time available or cycle time available; the form
enforces this.

**Simplifications** (each one written up in the UI's "How HOS is calculated" note):

- All time on the trip is driving. Fuelling, inspections, loading and traffic stops aren't
  modelled. So for a rested driver the 14-hour window only matters if they start the trip
  partway through a shift.
- Hours already used in the weekly cycle don't roll off during the trip. In reality, hours
  from 8 days ago drop off at midnight. Our approach never gives the driver more hours than
  the real rule would, so it can only be early on a restart, never late.
- No sleeper-berth split, adverse-driving extension, short-haul exemption or personal
  conveyance.
- All stops are taken where the limit is hit, not at a real truck stop.

**What the user sees** when HOS is on:

- Rest and break stops on the map as markers on each route, with type, start time, length
  and mile marker.
- In the route summary: total trip time including stops, number of rests and breaks, and
  arrival time.
- A label on the plan, "ETAs include Hours of Service stops", so a reviewer comparing with
  a navigation app knows why the times differ.

Weather at the stop locations (a truck parked through a windstorm) isn't rated. That's left for
later (§5 P2).

### 7.4 Risk rules

Risk levels, worst last: **Low < Moderate < High < Severe < No Travel**.

The brief's table has overlapping boundaries (0.25 appears in both Moderate and High) and gaps
for non-integer wind (34.5 mph). We use these exact boundaries, **lower bound inclusive**, with
the No Travel cut-offs for rain and snow strictly greater-than as written:

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | < 25 | 25 ≤ w < 35 | 35 ≤ w < 45 | 45 ≤ w < 55 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10 ≤ r < 0.25 | 0.25 ≤ r < 0.50 | 0.50 ≤ r ≤ 1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5 ≤ s < 1.0 | 1.0 ≤ s < 2.0 | 2.0 ≤ s ≤ 3.0 | > 3.0 |

**Load rules** (they change the wind rating only):

- Wind ≥ 55 mph → No Travel for any load (already in the table).
- 45 ≤ wind < 55 mph **and** load > 30,000 lb → No Travel.
- 35 ≤ wind < 45 mph **and** load > 40,000 lb → Severe.

**Checkpoint risk** = the worst of the (load-adjusted) wind, rain and snow levels. The UI names
the condition that set it, and says when a load rule raised it.

**Which wind value?** The table says "wind" without saying sustained or gust. We **use wind
gusts** for every wind threshold and load rule, because sudden gusts are what push high-sided
vehicles over. Sustained wind is shown next to the gust on every checkpoint as information
only; it never affects the rating.

**Snow** is snowfall depth per hour (not water equivalent). **Rain** is liquid precipitation
per hour.

**Missing forecast** (ETA beyond the forecast horizon, or provider gap) gives the checkpoint a
risk of **Unknown**. It is never counted as Low. Unknown miles are shown in the route summary.
If only some values are missing (say rain is present but gusts aren't), the checkpoint is still
Unknown, because a missing value could make it worse. The one exception is when a known value
is already No Travel: nothing missing could change that, so the checkpoint is No Travel.

### 7.5 Route metrics

Each checkpoint "owns" the stretch of road halfway back to the previous checkpoint and halfway
on to the next, so checkpoint miles always add up to the route length.

Per route:

- **Miles by level:** sum of owned miles per risk level.
- **Average risk:** distance-weighted mean of the numeric score Low 0, Moderate 1, High 2,
  Severe 3, No Travel 4 (Unknown excluded).
- **Worst risk** and where it occurs.
- **Drivable:** false if any checkpoint is No Travel.

### 7.6 Recommendation

Rank routes by, in order:

0. **No Travel miles** (fewest). Not in the brief's list, but a route with No Travel is
   worse than any amount of Severe. Routes with any No Travel are marked *Not drivable*.
1. **Severe miles** (fewest)
2. **High miles** (fewest)
3. **Average risk** (lowest)
4. **Travel time** (shortest). With Hours of Service on, this is total trip time including
   breaks and rests.

Miles are compared rounded to the nearest whole mile. Average risk is compared with a small
tolerance (default 0.05 on the 0–4 scale), so two routes with practically equal risk are split
by travel time. That is how the brief's "balancing weather risk and travel time" shows up
in the ranking. Without a tolerance, step 4 would almost never apply.

The recommended route shows a one-line reason built from the first criterion that separated it
from the runner-up.

If **every** route has No Travel miles, nothing is recommended. The app says so, still ranks
the routes, and suggests a later departure.

### 7.7 Map

- All routes drawn. Recommended route drawn on top and emphasised. Selecting a route in the side
  panel highlights it on the map, and the reverse.
- Checkpoints as dots coloured by risk. Hover gives a tooltip; click gives a detail card with ETA,
  mile marker, wind and gust, rain, snow, risk level, the condition that set it, and any load rule
  that applied.
- Legend for risk colours. Colours must also be told apart by people with colour-blind vision
  (we use a sequential palette plus labels, not just hue).
- Map fits to the routes after each plan.

### 7.8 Corridor heatmap

- Covers the area around all returned routes (a buffer of about 30 miles either side, narrowed
  from 40 to fit the free weather service's per-minute limit; RFC §8).
- Shows **composite risk for the user's load**, computed with the same rules as checkpoints, at
  each forecast hour from 0 (current hour) to 48.
- Slider from 0 to 48 h, labelled with the actual clock time. Play/pause button to animate.
- Scrubbing must be smooth (see §8). No network requests while scrubbing.
- Toggle to show or hide the heatmap.
- If the trip departs more than 48 h from now, say that the heatmap window doesn't overlap the
  trip.

### 7.9 Trips, guests and accounts

Every plan is saved as a **trip**: a snapshot of the inputs, the three routes with their
checkpoints and risk, the recommendation and the heatmap, exactly as the user saw them.
Forecasts change every hour, so re-computing later could give a different answer. The snapshot
is the record of what was recommended and why.

**Two kinds of user**

| | Guest | Signed-in user |
|---|---|---|
| Plan trips | Yes, no sign-up needed | Yes |
| Trip history | "Recent trips on this device", last 20 | "My trips", all of them |
| Kept for | 30 days | Until the user deletes them (unsaved history: 90 days) |
| Save and name a trip | No; prompted to create an account | Yes |
| Share link | Yes | Yes |
| Higher rate limits | No | Yes |

A guest is identified by their browser session, not by any personal data. **When a guest signs
up or logs in, their recent trips move into their account**, so nothing planned before signing
in is lost. Logging out starts a fresh guest session; the account's trips stay with the account.

**Accounts**

- Sign up with email and password; log in; log out. Passwords follow Django's strength rules.
- Signed-in users can delete their account, which deletes all their trips.
- Email verification and password reset by email are **out of scope for this assessment**
  (they need an email provider); a reviewer demo account is seeded instead. Google sign-in is P2.

**Trip actions**

- **Open** any trip from history: shows the saved snapshot, labelled "Planned Oct 11, 14:02 —
  forecast as of then".
- **Re-plan with current weather:** runs a new plan with the same inputs (departure moved to
  now if it's in the past) and opens it next to a link to the original.
- **Save** (signed-in): pin a trip and give it a name, e.g. "Dallas → Denver, Tuesday load".
  Saved trips are never purged.
- **Rename, delete.**
- **Share:** off by default. Turning it on makes the trip's link viewable read-only by anyone;
  turning it off revokes access immediately.

**Privacy and access**

- A trip is visible only to its owner (the account, or the guest session that created it),
  unless sharing is on.
- Someone opening a trip they can't see gets "Trip not found", the same as for a trip that
  doesn't exist, so trip ids can't be probed.
- Origins and destinations are location data, so guest trips are deleted after 30 days and
  unsaved signed-in history after 90.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| **Plan latency** | p95 under 6 s cold, under 1.5 s warm cache, for a 1,500-mile trip at a 10-mile interval. Routes and risk appear before the heatmap finishes loading. |
| **Heatmap smoothness** | Slider updates the frame within one animation frame (~16 ms) on a mid-range laptop. All 49 hours loaded once. |
| **Map performance** | Pan and zoom stay at 60 fps with 3 routes, ~600 checkpoints and the heatmap on. Checkpoints are drawn by the map's GPU layers, not as hundreds of DOM markers. |
| **Correctness** | Risk rules, load rules, ownership of miles, ranking and the HOS planner are covered by table-driven unit tests, including every boundary value in §7.4 and every HOS limit in §7.3.1. |
| **Resilience** | A weather or routing provider failure gives a clear message, not a blank screen or partial wrong answer. |
| **Security** | API keys only on the server. Rate limiting on public endpoints, stricter for guests and on login. Session cookies are httpOnly and Secure, with CSRF protection. Passwords hashed with Argon2. Every trip endpoint checks ownership, with tests proving one user can't read another's trips. |
| **Data integrity** | A trip and its routes are saved together or not at all. Database constraints enforce ranges, one owner per trip, and one route per rank. |
| **Availability** | The hosted demo must not cold-start for a minute when the reviewer opens it. |
| **Browser support** | Latest Chrome, Firefox, Safari, Edge. Usable at 1280 px and on a tablet. Phone layout is best effort. |
| **Accessibility** | Keyboard-usable form and slider, labelled controls, risk shown by text and not just colour. |

## 9. UX outline

Main planner page, two panes, under a header:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ◆ Weather Routing                        Recent trips ▾   [Log in] [Sign up]│
│                         (signed in:      My trips         (MK ▾)          ) │
├──────────────────────────────┬─────────────────────────────────────────────┤
│ Trip                         │                                             │
│  Origin      [Dallas, TX   ] │                                             │
│  Destination [Denver, CO   ] │                MAP                          │
│  Depart      [Oct 12 06:00 ] │   routes · checkpoints · corridor heatmap   │
│  Load (lb)   [42,000       ] │                                             │
│  Sample every (10)(25)(50) mi│                                             │
│  [ ] Hours of Service  ▸     │                                             │
│  [ Plan trip ]               │                                             │
├──────────────────────────────┤                                             │
│ ★ Route A  Recommended       │                                             │
│   0 severe mi · 12 high mi   │                                             │
│   13h 40m · arrives 19:40    │                                             │
│   "Fewest severe miles"      │                                             │
│ ○ Route B  38 severe mi …    │                                             │
│ ○ Route C  Not drivable …    ├─────────────────────────────────────────────┤
│                              │ Heatmap [on] ▶  ──●────────── +14h Sat 20:00│
└──────────────────────────────┴─────────────────────────────────────────────┘
```

Other pages:

- **Trip page** `/trips/<id>`: the same layout showing a saved snapshot, with a banner
  ("Planned Oct 11, 14:02 — forecast as of then"), and Re-plan, Save, Share and Delete actions.
  Shared trips open read-only for other people, with no actions.
- **My trips** `/trips` (signed in): list with name or "Origin → Destination", departure,
  load, recommended route and its worst risk level, saved star, planned date. Filter by saved;
  search by place.
- **Recent trips** (guest): a dropdown in the header with the last 20 trips on this device and a
  "Sign up to keep these" prompt.
- **Log in** / **Sign up**: simple centred forms; after success, return to where the user was.
- **Account**: email, log out, delete account (with confirmation).

States to design: empty (before the first plan), loading (routes first, then heatmap),
results, partial results (fewer than 3 routes, Unknown checkpoints), not drivable, no safe
route, error.

## 10. Success criteria

For the assessment, the project succeeds if:

- An evaluator can enter a real US trip on the hosted app and get 3 routes, a recommendation
  with a reason, and an interactive map within a few seconds.
- Every number shown can be traced back to a rule: clicking any checkpoint explains its rating.
- The heatmap slider scrubs smoothly across all 48 hours.
- The repo builds and runs locally from the README in under 10 minutes, tests pass, and the
  design decisions (this PRD and the RFC) explain the interpretation of every ambiguous rule.

## 11. Assumptions and interpretations

| # | Ambiguity in the brief | Decision |
|---|---|---|
| A1 | "every 10 / 25 / 50 miles" | User picks the interval; default 25 |
| A2 | Overlapping threshold boundaries | Lower bound inclusive; No Travel for rain/snow is strictly `>` |
| A3 | Sustained wind or gust | Gusts, for all wind thresholds and load rules. Sustained shown for information. |
| A4 | How to combine conditions | Worst of wind (load-adjusted), rain, snow |
| A5 | No Travel isn't in the ranking list | Ranked before Severe miles; such routes are flagged Not drivable |
| A6 | "Miles" at a risk level | Each checkpoint owns half the distance to its neighbours |
| A7 | "Lowest average risk" | Distance-weighted mean of 0–4 scores |
| A8 | Strict ranking leaves no room for travel time | Small tolerance on average risk so time can decide near-ties |
| A9 | Load rule gap (35–44 mph, 30,001–40,000 lb) | Applied literally: no change, stays High |
| A10 | Heatmap "0–48 h" anchor | Hours from now, not from departure |
| A11 | Region | North America (imperial units, US truck limits). Other regions may work but are not tested. |
| A12 | Time zones | Times shown in the origin's time zone, labelled. Stored and computed in UTC. |
| A13 | "Guest and logged-in check-ins" | Read as: both guests and signed-in users can plan trips, and each plan is recorded against its owner (guest session or account). |

## 12. Open questions

None open.

**Resolved (2026-10-14)**

- ~~Q3~~ No paid routing tier: HERE stays on its **free tier** (4,000 transactions a month each
  for routing and autosuggest). The app stops calling a service at 90% of its allowance and
  says so until the month resets; routes and place suggestions are cached to stretch it
  (RFC §5.1, §9). HERE's first real request returned five alternatives for Dallas → Denver,
  so the free tier's alternatives are good enough for long trips.

**Resolved (2026-10-11)**

- ~~Q1~~ Wind thresholds and load rules use **gusts**.
- ~~Q2~~ Hours of Service is an **optional toggle, off by default**. It covers the 11-hour
  driving limit, the 14-hour on-duty window, the 30-minute break and the 60/70-hour weekly
  cycle with a 34-hour restart (§7.3.1).
- Plans are saved as trips for guests and signed-in users, with accounts, guest-to-account
  trip transfer, My trips and share links (§7.9). Accounts are P1, behind the core features.

## 13. Deliverables

1. GitHub repository with README (setup, architecture, decisions, how to run tests).
2. Hosted application (frontend and API).
3. 5–10 minute Loom walkthrough: demo a trip where weather changes the recommendation, show
   a load rule changing a rating, scrub the heatmap, then a short code tour of the risk engine
   and its tests.
