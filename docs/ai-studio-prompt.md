Build a **frontend-only UI prototype** of a web app called **Spotter Weather Routing**. It helps a long-haul truck driver or dispatcher choose the safest of three routes based on the weather the truck will drive through, its load weight and travel time.

This is a design prototype. **Do not call the Gemini API or use `@google/genai` anywhere, and don't ask for an API key.** No backend, no real auth, no database: accounts and saved trips are part of the design, but fake them in the browser (see "Accounts and trips"). Use realistic mock data from local TypeScript modules, typed exactly like the API contract below, so the real Django API can replace the mocks later without changing components.

## Tech

- React + TypeScript + Tailwind (the setup this environment provides).
- Map: **maplibre-gl** used directly, wrapped in a small `MapView` component (`useRef` for the container and the `maplibregl.Map` instance, created once in `useEffect`). Don't use react-map-gl. Add the stylesheet `https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css` in `index.html`. No Mapbox, no token. Basemap style: `https://tiles.openfreemap.org/styles/positron` (light, muted, so risk colours stand out); use `https://tiles.openfreemap.org/styles/dark` in dark mode.
- Routing: **react-router-dom with `HashRouter`** (the preview runs in a frame, so hash URLs are safer).
- Forms: react-hook-form + zod. Icons: lucide-react. Dates: date-fns.
- No component library. Build a small set of accessible components in `components/ui/` with Tailwind: Button, Switch, SegmentedControl, Combobox, Popover, Dialog (use the native `<dialog>` element), Tooltip, Toast, Badge. Use native `<input type="range">` for the slider and `<select>` where it fits.
- Split code into small files by feature (`features/trip-form`, `features/routes-panel`, `features/map`, `features/heatmap`, `features/trips`, `features/auth`); no file over ~300 lines.
- Keep all mock data and types in `api/` (`types.ts`, `mock.ts`, and a `client.ts` exposing `planTrip(req)`, `getHeatmap(tripId)`, `listTrips()`, `getTrip(id)`, `updateTrip(id, patch)`, `deleteTrip(id)`, `replan(id)`, `getMe()`, `login()`, `signup()`, `logout()`, which resolve mocks after a fake delay of 1.2 s for planning and 0.3–0.8 s otherwise). Keep mock trips and the fake session in memory plus `localStorage`, so reloading keeps them.

## Look and feel

A calm, dense, professional **dispatch console**, not a consumer travel app. Think flight-ops or fleet software: neutral greys, one accent colour (deep blue `#1D4ED8`), compact type (Inter, tabular numbers for all times, miles and hours), 8 px spacing grid, subtle borders instead of heavy shadows. Information first, decoration last. Desktop-first at 1280–1920 px, usable on a tablet. Include a light and dark theme.

**Risk palette.** Use it everywhere: map, cards, legend, heatmap. Always pair colour with a text label; never rely on colour alone.

| Level | Colour | Score |
|---|---|---|
| Low | `#2F855A` | 0 |
| Moderate | `#D69E2E` | 1 |
| High | `#DD6B20` | 2 |
| Severe | `#C53030` | 3 |
| No Travel | `#44337A` | 4 |
| Unknown | `#A0AEC0` | — |

## Layout (single page)

```
┌─────────────────────────────┬───────────────────────────────────────────────┐
│ Left panel (400 px, scroll) │                                               │
│  1. Trip form               │                  MAP (fills)                  │
│  2. Route results           │   legend: bottom-left · layer toggles: top-right
│                             ├───────────────────────────────────────────────┤
│                             │ Heatmap bar: [on/off] ▶  0 ─────●──── 48 h     │
└─────────────────────────────┴───────────────────────────────────────────────┘
```

Header: small logo mark + "Weather Routing" on the left. On the right: for a **guest**, a "Recent trips" dropdown, "Log in" and "Sign up" buttons; for a **signed-in user**, a "My trips" link and an avatar menu (email, Account, Log out). Theme toggle at the far right.

Use react-router with routes `/` (planner), `/trips/:id` (a saved trip in the planner layout), `/trips` (My trips, signed in only), `/login`, `/signup`, `/account`.

### 1. Trip form

- **Origin** and **Destination**: combobox with autocomplete over a mock list of ~15 US cities (Dallas TX, Denver CO, Amarillo TX, Oklahoma City OK, Wichita KS, Kansas City MO, Albuquerque NM, Salt Lake City UT, Chicago IL, Memphis TN, Atlanta GA, Phoenix AZ, Omaha NE, Laredo TX, St. Louis MO). A swap button between them.
- **Departure**: date + time picker in the origin's time zone, showing the zone (e.g. "CDT"). Valid from now to 7 days ahead. Beyond 48 h, show a muted note: "Forecast confidence is lower more than 48 h out."
- **Load weight (lb)**: number input with thousands separators, 1–80,000, required. Helper text: "Loads over 30,000 lb and 40,000 lb raise wind risk."
- **Sample weather every**: segmented control 10 / 25 / 50 mi, default 25.
- **Hours of Service**: a switch, **off by default**. When on, smoothly expand:
  - Cycle: select "70 h / 8 days" (default) or "60 h / 7 days".
  - Four hour inputs styled like an ELD's clocks (small cards with a label and an `hh:mm` value): **Drive** (max 11:00), **Shift** (max 14:00), **Break in** (max 8:00), **Cycle** (max 70:00 or 60:00). Defaults are the maximums. Validate that Drive ≤ Shift and Drive ≤ Cycle.
  - A "How is this calculated?" link opening a popover: 11 h driving limit, 14 h on-duty window, 30 min break after 8 h of driving, 60/70 h weekly cycle with a 34 h restart. Simplifications: all trip time counts as driving, and weekly hours don't roll off during the trip.
- **Plan trip** button (full width, primary). Show errors inline under each field.

### 2. Route results

Appears after planning, with skeleton cards while loading.

- If any warnings, show a slim alert above the cards (e.g. "Only 2 distinct routes found").
- If no route is drivable, show a red alert: "No route is safe at this departure time. Try a later departure." Still list the routes.
- Three **route cards** in ranked order, each showing:
  - Rank and name ("Route A · via Amarillo"). The recommended one gets a "Recommended" badge and a one-line reason in italics, e.g. *"Fewest severe miles (0 vs 38)"*.
  - A not-drivable route gets a "Not drivable" tag and a muted red border.
  - Key numbers in a compact grid: distance (mi), drive time, **arrival** (day + time + zone), average risk (0–4, one decimal), worst level as a coloured pill.
  - A horizontal **stacked risk bar** showing miles per level, with a tooltip per segment ("High · 44 mi").
  - With HOS on: "Trip 23 h 02 m incl. 1 break, 1 rest" and a small expandable list of stops (icon, type, start time, duration, mile).
  - Clicking a card selects that route on the map, and the reverse. Hovering a card highlights its line.
- Under the selected card, an expandable **checkpoint table**: mile, ETA, gust (mph), rain (in/hr), snow (in/hr), level pill. Clicking a row flies the map to that checkpoint and opens its popup.

## Map

- Fit to all routes after planning, with padding for the left panel.
- **Routes:** unselected routes as grey lines (4 px, 70% opacity). The selected route is drawn on top as **segments coloured by risk** (6 px, with a white casing), so the driver can see where the danger is.
- **Checkpoints:** one GPU `circle` layer (not DOM markers; there may be 600+), coloured by level, radius scaling with zoom, white stroke. Only show checkpoints for the selected route, plus faded ones for the others.
- **Hover tooltip** on a checkpoint: level and ETA. **Click popup** card: mile marker, ETA, gust and sustained wind (label sustained as "for info"), rain, snow, final level, which condition set it ("Driven by wind"), and the load rule if one applied, e.g. **"Raised High → Severe: gust 38 mph with a 42,000 lb load (> 40,000 lb rule)"**.
- **HOS stops** (only when HOS is on): a symbol layer with distinct icons for Break (coffee), Rest (bed) and Restart (rotate), with popups giving start, duration and reason.
- Origin and destination pins.
- **Legend** (bottom-left, collapsible): the six risk levels with labels.
- **Layer toggles** (top-right): Heatmap, Checkpoints, Other routes.

## Corridor heatmap and 48-hour slider (must be buttery smooth)

The bar under the map has a heatmap on/off switch, a play/pause button, and a slider from 0 to 48 hours from **now**. The label shows offset and clock time, e.g. "+14 h · Sat 20:00 CDT". Tick marks every 6 h. Keyboard arrows step 1 h. Play advances 1 h every 250 ms and loops.

Implementation (important for performance):

- The heatmap data is a uniform grid of points (~600) around the routes. Each point is one GeoJSON feature with **flat** properties `h0` … `h48`, each holding the risk score 0–4 for that hour. Don't put arrays in properties; MapLibre can't index them.
- Render with a MapLibre `heatmap` layer below the routes. `heatmap-weight` = `["/", ["get", "h<hour>"], 4]`, `heatmap-radius` interpolated by zoom so cells merge without gaps, `heatmap-color` ramp using the risk palette (transparent at 0), opacity ~0.6.
- **On slider change, call `map.setPaintProperty("corridor-heat", "heatmap-weight", …)` only.** Don't rebuild the source, don't re-render the map React tree. Throttle with `requestAnimationFrame`. Keep the slider hour in its own small context so dragging re-renders only the slider and the layer.
- If the departure is more than 48 h away, show a note on the bar: "Heatmap window ends before departure."
- Bonus: while scrubbing, show a small truck dot on each route at the position the truck would be at that hour (hidden before departure and after arrival).

## Mock data (make it realistic and internally consistent)

Default scenario that loads when the user clicks Plan with the prefilled values: **Dallas, TX → Denver, CO**, departure tomorrow 06:00 CDT, **42,000 lb**, every 25 mi.

Three routes, built by interpolating along these waypoints (lon, lat):

- **Route A · via Amarillo** (US-287, ~795 mi, 12 h 32 m): Dallas (-96.80, 32.78) → Wichita Falls (-98.49, 33.91) → Amarillo (-101.83, 35.22) → Dalhart (-102.52, 36.06) → Raton (-104.44, 36.90) → Pueblo (-104.61, 38.25) → Denver (-104.99, 39.74).
- **Route B · via Wichita** (I-35/I-70, ~880 mi, 13 h 20 m): Dallas → Oklahoma City (-97.52, 35.47) → Wichita (-97.34, 37.69) → Salina (-97.61, 38.84) → Hays (-99.33, 38.88) → Limon (-103.69, 39.26) → Denver.
- **Route C · via Lubbock** (~840 mi, 13 h 05 m): Dallas → Abilene (-99.73, 32.45) → Lubbock (-101.86, 33.58) → Clovis (-103.21, 34.40) → Santa Rosa (-104.68, 34.94) → Raton → Pueblo → Denver.

Weather story: **a fast-moving windstorm with snow crosses western Kansas and eastern Colorado** between roughly +10 h and +20 h. Route B drives straight through it (38 Severe miles, some High); Route C hits rain and moderate gusts in New Mexico; Route A clips the edge (0 Severe, ~12 High). So **A is recommended: "Fewest severe miles (0 vs 38)"**. Add a second scenario toggle in a small "Demo scenario" menu in the header where the storm is stronger and Route B has a **No Travel** stretch (gusts 58 mph), so the "Not drivable" state can be seen.

Generate checkpoint weather with a deterministic function of (lon, lat, hour), modelling the storm as a moving ellipse, and apply these rules in `mock.ts` so every rating is consistent:

- Gust (mph): Low < 25, Moderate 25–<35, High 35–<45, Severe 45–<55, No Travel ≥ 55.
- Rain (in/hr): Low < 0.10, Moderate 0.10–<0.25, High 0.25–<0.50, Severe 0.50–1.00, No Travel > 1.00.
- Snow (in/hr): Low < 0.5, Moderate 0.5–<1.0, High 1.0–<2.0, Severe 2.0–3.0, No Travel > 3.0.
- Load rules on gusts: 45–<55 mph and load > 30,000 lb → No Travel; 35–<45 mph and load > 40,000 lb → Severe.
- Checkpoint level = the worst of (load-adjusted) wind, rain and snow. Each checkpoint covers half the distance to its neighbours, for the miles-per-level totals.

Generate the heatmap grid from the same storm function, so the map, slider and cards always agree.

## Types (match exactly)

```ts
type Level = "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "NO_TRAVEL" | "UNKNOWN";

interface PlanRequest {
  origin: Place; destination: Place;
  departure: string;            // ISO with offset
  load_lb: number;
  interval_mi: 10 | 25 | 50;
  hos: { enabled: false } | {
    enabled: true; cycle: "70h_8d" | "60h_7d";
    drive_left_h: number; window_left_h: number; until_break_h: number; cycle_left_h: number;
  };
}
interface Place { label: string; lat: number; lon: number; tz: string }

interface PlanResponse {
  trip_id: string;
  generated_at: string;
  recommended_route_id: string | null;
  recommendation_reason: string | null;
  warnings: string[];
  routes: Route[];
}
interface Route {
  id: string; name: string; rank: number;
  coordinates: [number, number][];        // lon, lat (the real API sends an encoded polyline)
  distance_mi: number; duration_s: number; trip_duration_s: number;
  departure: string; arrival: string;
  metrics: {
    miles_by_level: Record<Level, number>;
    avg_risk: number | null; worst: Level | null; worst_at_mile: number | null;
    drivable: boolean;
  };
  checkpoints: Checkpoint[];
  hos_stops: HosStop[];
}
interface Checkpoint {
  mile: number; owned_mi: number; lat: number; lon: number; eta: string;
  forecast: { valid_hour: string; wind_mph: number; gust_mph: number;
              rain_in_hr: number; snow_in_hr: number; weather_code: number } | null;
  risk: { level: Level; driver: "wind" | "rain" | "snow" | null;
          wind: Level; wind_adjusted: Level; rain: Level; snow: Level;
          load_rule: "wind_45_54_over_30k" | "wind_35_44_over_40k" | null };
}
interface HosStop {
  kind: "break" | "rest" | "restart";
  reason: "break" | "drive_limit" | "window" | "cycle";
  mile: number; lat: number; lon: number; start: string; duration_s: number;
}
interface HeatmapResponse {
  start_hour: string; hours: 49; cell_deg: number;
  points: [number, number][];             // lon, lat
  risk: number[][];                       // risk[pointIndex][hour], 0–4
}
```

## Accounts and trips

Every plan is saved as a **trip**, a snapshot of exactly what the user saw. Guests can plan without signing up; signing up keeps their trips.

- **Recent trips dropdown (guest):** last 20 trips on this device (route summary, departure, worst risk pill, "2 h ago"), and a callout at the bottom: "Sign up to keep these trips on any device."
- **Log in / Sign up pages:** centred card, email and password (sign-up has password strength hints), link between the two, errors inline. After success, return to the previous page and show a toast: "3 trips from this device were added to your account."
- **My trips page `/trips`:** a table/list of trips: star for saved, name (or "Dallas → Denver"), departure, load, recommended route and its worst risk pill, planned date. Filter tabs "All / Saved", search by place, row actions (open, rename, share, delete with confirm). Empty state with a "Plan a trip" button.
- **Trip page `/trips/:id`:** the planner layout pre-filled and read-only, with a banner: "Planned Oct 11, 14:02 · forecast as of then" and actions **Re-plan with current weather**, **Save** (star + name; for guests this opens a "Create an account to save trips" dialog), **Share** (switch + copy link; "Anyone with the link can view"), **Delete**. If opened by someone else via a shared link: no actions except "Re-plan with current weather", and a "Shared trip" label.
- **Account page:** email, Log out, and a "Delete account" danger zone that asks for the password and explains all trips will be deleted.
- Add a "Sign in as demo user" shortcut on the login page (mock), and seed that user with 4 saved trips.

Extra types:

```ts
interface TripSummary {
  id: string; name: string; saved: boolean; shared: boolean; created_at: string;
  origin_label: string; destination_label: string; departure: string; load_lb: number;
  recommended_route_name: string | null; worst_level: Level | null;
}
interface Trip extends PlanResponse {
  name: string; saved: boolean; shared: boolean; created_at: string;
  is_owner: boolean; replanned_from: string | null;
}
interface Me { user: { email: string } | null; guest: boolean; recent_trip_count: number }
```

## States to design

Empty (before the first plan: the map shows the continental US, and the left panel has a short explainer of what the app does in 3 bullet points). Loading (route skeletons first, then the heatmap fades in separately). Results. Partial results (fewer than 3 routes, Unknown checkpoints in grey). Not drivable. No safe route. Error with a retry button (add a "Simulate error" item to the Demo scenario menu).

## Accessibility

All controls keyboard-reachable with visible focus rings. The slider has `aria-valuetext` like "+14 hours, Saturday 20:00". Risk is always shown as text plus colour. Contrast is AA in both themes.

## Out of scope

Real APIs, real authentication, email flows (verification, password reset), turn-by-turn navigation, mobile-first layout.
