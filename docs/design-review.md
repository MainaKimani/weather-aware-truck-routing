# Design review: AI Studio prototype

Review of the AI Studio prototype at <https://spotter-weather-routing.ai.studio> against
PRD §7–§9, done for [SPOT-4](./tasks.md#spot-4--build-ui-prototype-in-ai-studio-and-review)
on 2026-10-11. It runs on mock data, so the review covers layout, states and interaction. The
risk numbers come from the mocks and say nothing about our logic.

The design is the visual reference for the frontend tasks (SPOT-50 onwards). The fixes listed
below are part of building those tasks; they don't change the PRD.

## Keep

| Area | What to keep | Used in |
|---|---|---|
| Layout | Left panel (collapsible trip form above route cards), full-height map, bottom timeline bar. Dark chrome, light basemap, monospaced numbers. | SPOT-50 |
| Header | Logo, demo-scenario picker, Recent trips (guest), Log in / Sign up; when signed in, My trips plus the user menu. Theme toggle. | SPOT-50, 120, 122 |
| Trip form | Origin/destination with time-zone chip and swap button, departure in the origin's zone, load with the "over 30,000 / 40,000 lb" hint, 10/25/50 mi segmented control, HOS toggle with "How is this calculated?" link. The button shows "Evaluating weather corridors…" while loading. | SPOT-60, 64 |
| HOS fields | Cycle select (70 h / 8 days, 60 h / 7 days), four clocks (drive, shift, since break, cycle) with their maximums. | SPOT-61 |
| Route cards | Name "Route A · via Amarillo", Recommended / Not drivable badges, reason line, distance, drive time, arrival, average risk "x / 4.0", worst-condition chip. HOS summary "Trip 23 h 07 m (incl. 1 break, 1 rest)" with a stops list. | SPOT-62, 73 |
| Checkpoint table | Mile, ETA, gust, rain, snow, risk chip; inline under the route card. | SPOT-63 |
| Map | Recommended route drawn with risk-coloured checkpoints, alternatives in grey, HOS stop markers, a collapsible risk legend with scores, and a Layers menu (heatmap, checkpoints, alternatives). | SPOT-70–74 |
| Timeline | "+12 h · Monday 07:04 CDT" readout, 6-hour ticks, play/loop button, Corridor heat toggle. | SPOT-81 |
| Trip page | Title with Rename, Save, Share, Delete, plus "Planned … · forecast as of then" and Re-plan. URL `#/trips/:id`. | SPOT-121, 125 |
| Accounts | Login card with "Sign in as demo user", My trips table (All / Saved tabs, search, row actions), the "N trips from this device were added to your account" toast, an account page with Log out and a danger zone. | SPOT-123, 124, 126, 115 |
| Error state | An inline error card in the routes panel with a "Retry route analysis" button. | SPOT-64 |

## Fix when building

Ordered by impact on grading. Map and heatmap smoothness is 35% of the grade.

1. **Heatmap is not a corridor grid.** It renders as blurred heatmap blobs in diagonal bands,
   spills across the whole map rather than following the routes, and stays green even under
   the Extreme Winds (No Travel) preset. It vanished after a re-plan and doesn't visibly change
   when the slider moves. Build it as RFC §8 specifies: a `fill` layer of grid cells buffered
   around the routes, with `h0..h48` risk properties, coloured with the risk palette, where the
   slider only calls `setPaintProperty`. (SPOT-42, 80, 81)
2. **Route-card risk strip is empty.** The bar between "0 mi" and the route length is plain
   grey. It should show each owned-mile span in its risk colour. (SPOT-62)
3. **Mock results contradict themselves.** Under Standard Storm the reason says "Fewest severe
   miles (0 vs 38)", yet routes B and C show a worst condition of Moderate and Low. Switching
   presets changes only the heatmap until you re-plan. With real data this goes away, but the
   SPOT-30 demo scenarios must be internally consistent. (SPOT-30)
4. **Guests are shown as having saved a trip.** While signed out, the trip header shows a
   filled "Saved" star with the label "Saved to your account". PRD §7.9 says only signed-in
   users can save; for a guest, Save should invite sign-up. (SPOT-121, 125)
5. **The error state leaves the previous result on the map.** The error card appears, but the
   old routes and heatmap stay drawn with nothing marking them stale. The copy also blames
   "NOAA"; our weather provider is Open-Meteo. Clear or dim the map and name the provider
   correctly. (SPOT-64)
6. **HOS details.** The 10-hour rest shows as "600 min" instead of "10 h". Only one stop marker
   was visible on the map for a route with a break and a rest. (SPOT-62, 73)
7. **Small layout and state bugs.**
   - The login card sits left of centre.
   - Recent trips showed "No recent trips (0)" straight after planning, and then 5 trips on
     the next page.
   - The Recent trips menu doesn't close on Escape. (SPOT-122, 123)
8. **Accessibility.** Six icon-only buttons have no accessible name: the logo, demo picker,
   form collapse, legend toggle and the two map controls. (SPOT-91)
9. **Debug overlay.** The FPS meter in the map's top-left corner is useful for SPOT-92, but
   should only appear with `?debug`. (SPOT-92)
10. **Copy.**
    - The account page claims "Verified Dispatcher" and "ELD configurations across your
      fleet". We have neither, so drop both.
    - The checkpoint table shows only gusts. PRD §7.4 also shows sustained wind for
      information, so add it to the popup or the table. (SPOT-63, 126)

## Not reviewed

- Mobile widths. PRD §9 targets desktop first; it gets checked in SPOT-91.
- Light theme.
- The prototype's source. It has not been exported to the repo yet (see SPOT-4).
