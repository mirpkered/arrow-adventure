# Shared-Board Game Design

## Active prototype rules

The reset prototype has one board of winding arrows. Each arrow is an ordered polyline from tail to head. Points are aligned to a half-cell lattice; each segment is one cardinal or 45-degree diagonal unit. This permits close parallel routes to sit between whole-cell lanes without changing the eight-direction path model. A path cannot revisit a point, leave the board, disconnect, or self-intersect.

When selected, the head moves continuously along the full route and then continues in its final heading. Every part of the body follows by distance along that same route, and the tail retracts. The SVG board updates existing elements on `requestAnimationFrame`; animation speed is a timing preference and has no effect on move legality. Restart invalidates an active animation.

Collision checks use continuous segment distance plus the arrowhead triangle. Swept movement is sampled every 0.05 board-cell units, and the interval is conservatively included in collision clearance. This checks the entire moving body, head, turns and exit. The solver uses this same movement simulator, so its removal sequences match gameplay. The canonical collision envelope is fixed at 0.18 cells, including the largest head geometry. Thin, Medium and Bold only change the visible line and head dimensions; they cannot change static validation, collisions, solver results or heart deductions.

Arrow selection uses one delegated `pointerdown` handler. Pointer coordinates are transformed to board coordinates and compared with every path; the nearest centerline within 0.75 cells wins, with arrow ID as deterministic tie-break. The separate click handler only handles controls, so a synthesized touch click cannot activate an arrow twice. The 220 ms action gate suppresses rapid duplicate input and is reset when an animation completes or a level restarts.

The app opens with the Merpworks launch splash, then presents a composed title menu. Play, Continue, Settings, and Credits use responsive touch-sized controls. The gameplay shell fills the dynamic viewport, respects safe-area insets, and prevents page scrolling. The board is fitted initially, supports pinch zoom and panning, and can be reset to fit. In development and explicitly flagged QA builds, holding the compact level label for two seconds opens temporary settings; release, cancellation or pointer drift over ten CSS pixels cancels the hold. Enter or Space opens it for keyboard testing. The panel adjusts speed and stroke width, toggles diagnostics, jumps among six levels, restarts, displays solver-backed board state, and highlights a safe arrow. QA navigation runs temporarily and does not persist progress. Production builds omit the dynamically imported QA panel chunk.

## Curated QA set

The catalog contains exactly six fixed puzzle definitions, with stable local IDs `shared-board-001` through `shared-board-006`. Each entry includes a title, difficulty and design note. The JSON puzzle definitions are frozen in tests by SHA-256 fingerprints. Automated validation checks structure, geometry, variety, dependencies, the normal solver, and every state reachable through successful removals. This audit runs in tests/deployment validation, not during app startup.

Round 6 exhaustively checked 842 reachable states and 2,948 legal transitions across all six levels. No reachable state deadlocks. The exact Level 4 report and seven-arrow reconstruction are in [Solvability Audit](SOLVABILITY_AUDIT.md). The collision and solver rules were not changed for that report.

| Level | Board | Arrows | Centerline occupancy* | Interleaved pairs | Close segment contacts | Blocker links | Dependency depth | Initially removable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 — Small Tangle | 9×9 | 7 | 0.67 | 7 | 119 | 10 | 5 | 2 |
| 2 — Dense Mini-Maze | 12×11 | 12 | 0.71 | 10 | 222 | 18 | 7 | 4 |
| 3 — Nested Paths | 12×12 | 7 | 0.53 | 6 | 131 | 4 | 4 | 3 |
| 4 — Interwoven Board | 14×12 | 10 | 0.64 | 8 | 224 | 16 | 8 | 2 |
| 5 — Shaped Puzzle | 13×14 | 7 | 0.40 | 4 | 100 | 10 | 3 | 3 |
| 6 — Dense Challenge | 16×16 | 16 | 0.67 | 20 | 354 | 23 | 7 | 6 |

\*Centerline occupancy is total route length divided by board area. It is a density proxy, not a filled-pixel percentage. The shaped board uses less rectangular space intentionally. Contact totals count near segment pairs, not unique locations; visual review remains necessary.

Levels alternate between compact and broad compositions. Level 5 is hand-authored as a canopy-and-trunk silhouette; Levels 5 and 6 include diagonal path segments. The path lengths, turns, direction variety and dependencies vary within each puzzle instead of relying on a repeated serpentine template.

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

The title screen provides Play, Continue, Settings and Credits. The in-game pause sheet offers Resume, Restart, Settings and Return to Title. A versioned local save stores the stable current level ID, completed level IDs, remaining arrows, red failure marks, hearts and completion state. It never serializes intermediate animation frames. Invalid or unknown saves are ignored without deleting the raw value. The retired `mirpworks.arrow-adventure.save.v1/v2` records are never read or imported.

Production uses `arrow-adventure.production.*` keys. QA uses `arrow-adventure.qa.*` keys because GitHub Pages project URLs share the `github.io` origin; path separation alone would not isolate `localStorage`. Appearance and audio settings have the same environment separation. Light is the default only when no valid preference is saved; explicit Light, Dark, and Automatic preferences remain respected. Automatic follows the system appearance, and theme changes rerender the current screen without restarting the board. Optional synthesized music is off by default; original sound effects can be toggled separately. Audio settings do not pause or interrupt other apps' music.

Three hearts, restart, and numbered progression remain the only gameplay rules. There is no persistent level selector, tutorial, generator, Free Play, black holes, switches, gates, portals, undo, timer or monetization. Further mechanics remain future work.

## Launch splash

The app reuses `public/branding/mirpworks-logo.jpg` and timing adapted from Word Search Adventure's `launchSplash.ts`: 750 ms initial hold, fade starting at 1950 ms, black transition at 2800 ms, application reveal at 3000–3150 ms, completion at 3750 ms, and 4550 ms failsafe. Reduced-motion timing is shortened. The splash runs once during initial document boot; in-app navigation and returning to an already-running tab do not reinitialize it.

## Branding and delivery

The approved logo master remains at `public/branding/arrow-adventure-official-logo.png`; icon derivatives are in `public/icons/` and PWA metadata is in `public/site.webmanifest`. QA deploys only by selecting a source SHA in the independent QA repository. The production Pages deployment and `main` remain separate.
