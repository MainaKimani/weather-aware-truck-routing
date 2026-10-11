# AI Studio follow-up prompts

Use these after the first build in AI Studio (`docs/ai-studio-prompt.md`), one at a time,
only for the parts that came out weak. Each one is self-contained.

## 1. Heatmap smoothness

> The heatmap slider must not rebuild the map or its data. Check and fix: (1) the heatmap
> GeoJSON with flat `h0`…`h48` properties is built once per heatmap response and added with
> `addSource` once; (2) on slider input, the only map call is
> `map.setPaintProperty("corridor-heat", "heatmap-weight", ["/", ["get", "h" + hour], 4])`,
> wrapped in `requestAnimationFrame` so it runs at most once per frame; (3) the slider hour lives
> in its own React context, so the routes panel and map component don't re-render while
> dragging; (4) Play advances 1 h every 250 ms and loops. Add a small dev-only FPS readout in the
> corner of the map so I can check it stays near 60 while dragging.

## 2. Map layers

> Make sure checkpoints are drawn by a single MapLibre `circle` layer from one GeoJSON source,
> not DOM markers. Selecting a route or hovering a checkpoint must change only filters,
> paint properties or `feature-state`, never call `setData`. Draw the selected route as segments
> coloured by risk with a white casing, other routes grey underneath. Hover shows a tooltip;
> click opens the checkpoint popup described in the original brief, including the load-rule
> sentence.

## 3. Accounts and trips

> Complete the mocked accounts flow from the original brief: guest header with Recent trips,
> Log in, Sign up; signed-in header with My trips and an avatar menu; login and sign-up pages
> with a "Sign in as demo user" shortcut; on sign-in, move the guest's trips into the account
> and show the toast "N trips from this device were added to your account"; My trips page with
> All/Saved tabs, search, rename, share, delete; trip page with the "Planned … · forecast as of
> then" banner and Re-plan, Save, Share, Delete; account page with delete account. Persist the
> fake session and trips in localStorage.

## 4. States

> Add a "Demo scenario" menu in the header with: Default storm, Strong storm (Route B not
> drivable), Only 2 routes, Weather partly unavailable (some Unknown checkpoints), Simulate
> error. Make sure each state from the brief looks finished: empty, loading skeletons, partial
> results, not drivable, no safe route, error with retry.

## 5. Polish

> Review the whole app against the brief's look and feel: a calm, dense dispatch console,
> neutral greys with one blue accent, Inter with tabular numbers, 8 px grid, subtle borders,
> working light and dark themes (including the map style). Every risk colour must come with a
> text label. Check keyboard focus rings on every control and that the slider has
> `aria-valuetext` like "+14 hours, Saturday 20:00".
