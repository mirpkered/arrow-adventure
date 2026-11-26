# Shared-Board Game Design

> **Round 11 status:** The active development catalog contains five compactness-refined First Flight levels under `first-flight-r3-compact-weave`. Round 10 layouts remain archived; the active production deployment is not changed by this development branch. The candidate is deployed only to isolated QA for review. See [Roadmap](ROADMAP.md) and [Round 11 Compactness](ROUND_11_COMPACTNESS.md).

## Active prototype rules

Each arrow is an ordered polyline from tail to head. New Adventure levels use an explicit visible-cell grid: an `W×H` board draws `W+1` by `H+1` intersections at integer coordinates, with `pathOffset: 0`. There are no hidden half-cell routes. Historical content and older QA prototypes without that explicit spec retain the legacy 0.5-unit grid and 0.5 offset. Every level's grid spec is applied consistently to SVG rendering, zoom, pan, touch coordinates, movement, collision, solver and fit bounds. Segments are one grid unit and may be horizontal, vertical, or exact 45° diagonals; Round 10 uses orthogonal routes. A path cannot revisit a point, leave the board, disconnect, or self-intersect.

When selected, the head moves continuously along the full route and then continues in its final heading. Every part of the body follows by distance along that same route, and the tail retracts. The SVG board updates existing elements on `requestAnimationFrame`; animation speed is a timing preference and has no effect on move legality. Restart invalidates an active animation.

Collision checks use continuous segment distance plus the arrowhead triangle. Swept movement is sampled every 0.05 board-unit distances, and the interval is conservatively included in collision clearance. This checks the entire moving body, head, turns and exit. The solver uses this same movement simulator, so its removal sequences match gameplay. The canonical collision envelope is fixed at 0.18 board units, including a conservative maximum head geometry. The default visible body is 0.12 units; QA body presets are 0.12, 0.15, and 0.18. The visible arrowhead stays at its existing 0.15-unit reference size for every body preset. Appearance choices cannot change static validation, collisions, solver results, or heart deductions.

A fine, low-contrast board grid is rendered beneath arrows in the same SVG. It is visible in both themes and remains aligned automatically during fit, zoom, and pan. New Adventure boards draw only their true visible cell lattice; legacy half-unit puzzles retain their former denser grid. The QA geometry diagnostic can emphasize the configured intersections.

Arrow selection uses one delegated `pointerdown` handler. Pointer coordinates are transformed to board coordinates and compared with every path; the nearest centerline within 0.75 cells wins, with arrow ID as deterministic tie-break. The separate click handler only handles controls, so a synthesized touch click cannot activate an arrow twice. The 220 ms action gate suppresses rapid duplicate input and is reset when an animation completes or a level restarts.

The app opens with the Mirpworks launch splash, then presents a composed title menu. Play, Continue, Settings, and Credits use responsive touch-sized controls. The gameplay shell fills the dynamic viewport, respects safe-area insets, and prevents page scrolling. The board is fitted initially, supports pinch zoom and panning, and can be reset to fit. In development and explicitly flagged QA builds, holding the compact level label for two seconds opens temporary settings; release, cancellation or pointer drift over ten CSS pixels cancels the hold. Enter or Space opens it for keyboard testing. The panel adjusts speed and stroke width, toggles diagnostics, jumps among the five active levels, restarts, displays solver-backed board state, and highlights a safe arrow. QA navigation runs temporarily and does not persist progress. Production builds omit the dynamically imported QA panel chunk.

## Round 8 catalog baseline (historical)

The catalog contains exactly six fixed puzzle definitions, with stable local IDs `shared-board-001` through `shared-board-006`. Each entry includes a title, difficulty and design note. The JSON puzzle definitions are frozen in tests by SHA-256 fingerprints. Automated validation checks structure, geometry, variety, dependencies, the normal solver, and every state reachable through successful removals. This audit runs in tests/deployment validation, not during app startup.

Round 6 first exhaustively checked 842 reachable states and 2,948 legal transitions. The self-geometry addendum corrected four unsafe exit routes and checked 536 states and 1,571 transitions. Round 8's Level 5 refinement raises the current exact audit to 555 states and 1,622 legal transitions, with no deadlocks or dependency cycles. The Level 3 reproduction, Level 4 seven-arrow reconstruction, and current results are in [Solvability Audit](SOLVABILITY_AUDIT.md).

| Level | Board | Arrows | Centerline occupancy* | Interleaved pairs | Close segment contacts | Dependency depth | Initially removable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 — Small Tangle | 9×9 | 7 | 0.67 | 7 | 119 | 5 | 2 |
| 2 — Dense Mini-Maze | 12×11 | 12 | 0.71 | 10 | 222 | 7 | 4 |
| 3 — Nested Paths | 12×12 | 7 | 0.53 | 6 | 131 | 2 | 4 |
| 4 — Interwoven Board | 14×12 | 10 | 0.64 | 8 | 218 | 8 | 2 |
| 5 — Shaped Puzzle | 12×14 | 8 | 0.58 | 6 | 141 | 3 | 4 |
| 6 — Dense Challenge | 16×16 | 16 | 0.67 | 20 | 354 | 8 | 5 |

\*Centerline occupancy is total route length divided by board area. It is a density proxy, not a filled-pixel percentage. The shaped board uses less rectangular space intentionally. Contact totals count near segment pairs, not unique locations; visual review remains necessary.

Levels alternate between compact and broad compositions. Level 5 is hand-authored as a fuller canopy-and-hooked-trunk silhouette; Level 6 remains the unchanged quality benchmark. Levels 5 and 6 include diagonal path segments. The path lengths, turns, direction variety and dependencies vary within each puzzle instead of relying on a repeated serpentine template.

## Interlocking and QA measurements

`analyzeLevel` reports:

- **Centerline occupancy:** path distance divided by board area.
- **Close segment contacts:** distinct segment pairs no farther than 1.5 board cells.
- **Interleaved pairs:** arrow pairs with at least three close segments on each route, measuring repeated neighborhood weaving rather than bounding-box overlap.
- **Blocker links and per-arrow blockers:** arrows that prevent another arrow from exiting under the full simulator.
- **Initially removable:** safe choices before any removal.
- **Unlock gains:** additional initially safe choices after each initial safe removal.
- **Dependency depth:** number of safe-removal waves when all currently available arrows are cleared each wave.
- **Path lengths and turns:** a range check for route and shape variety.

These metrics screen weak boards but do not prove readability. Inspect the full board at phone scale and play it with each visible stroke preset. Use the QA ownership and hit-target overlays to check close neighboring arrows. The current geometry preview is available at `docs/previews/round-4-levels.png`; it is a local render, not a mobile-browser screenshot.

## Menus, saves and appearance

The title screen provides Play, Continue, Settings and Credits. The in-game pause sheet offers Resume, Restart, Settings and Return to Title. Round 11 uses save schema v4 and catalog `first-flight-r3-compact-weave`; saves record the active level content version. Migration from Round 10 schema v3 preserves completed IDs and the selected level, resets only an unfinished board whose geometry changed, and leaves appearance/audio preferences untouched. The source save is removed only after a successful v4 write. New saves store stable IDs, remaining arrows, red failure marks, hearts and completion state, never intermediate animation frames. Invalid or unknown saves are ignored. The retired `mirpworks.arrow-adventure.save.v1/v2` records are never imported.

Production uses `arrow-adventure.production.*` keys. QA uses `arrow-adventure.qa.*` keys because GitHub Pages project URLs share the `github.io` origin; path separation alone would not isolate `localStorage`. Appearance and audio settings have the same environment separation. Light is the default only when no valid preference is saved; explicit Light, Dark, and Automatic preferences remain respected. Automatic follows the system appearance, and theme changes rerender the current screen without restarting the board. Optional synthesized music is off by default; original sound effects can be toggled separately. Audio settings do not pause or interrupt other apps' music.

Three hearts, restart, and numbered progression remain the only gameplay rules. Adventure Mode loads five frozen true-grid levels. There is no Free Play, runtime Adventure generator, black holes, switches, gates, portals, undo, timer or monetization. Future silhouette support should keep a regular logical grid and clip its rendering to an authored footprint; it is not implemented.

## Launch splash

The app reuses `public/branding/mirpworks-logo.jpg` and timing adapted from Word Search Adventure's `launchSplash.ts`: 750 ms initial hold, fade starting at 1950 ms, black transition at 2800 ms, application reveal at 3000–3150 ms, completion at 3750 ms, and 4550 ms failsafe. Reduced-motion timing is shortened. The splash runs once during initial document boot; in-app navigation and returning to an already-running tab do not reinitialize it.

## Branding and delivery

The approved logo master remains at `public/branding/arrow-adventure-official-logo.png`; icon derivatives are in `public/icons/` and PWA metadata is in `public/site.webmanifest`. QA deploys only by selecting a source SHA in the independent QA repository. The production Pages deployment and `main` remain separate.
