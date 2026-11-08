# Shared-Board Game Design

## Active prototype rules

The reset prototype has one board of winding arrows. Each arrow is an ordered polyline from tail to head. Points are aligned to a half-cell lattice; each segment is one cardinal or 45-degree diagonal unit. This permits close parallel routes to sit between whole-cell lanes without changing the eight-direction path model. A path cannot revisit a point, leave the board, disconnect, or self-intersect.

When selected, the head moves continuously along the full route and then continues in its final heading. Every part of the body follows by distance along that same route, and the tail retracts. The SVG board updates existing elements on `requestAnimationFrame`; animation speed is a timing preference and has no effect on move legality. Restart invalidates an active animation.

Collision checks use continuous segment distance plus the arrowhead triangle. Swept movement is sampled every 0.05 board-cell units, and the interval is conservatively included in collision clearance. This checks the entire moving body, head, turns and exit. The solver uses this same movement simulator, so its removal sequences match gameplay. The canonical collision envelope is fixed at 0.18 cells, including the largest head geometry. Thin, Medium and Bold only change the visible line and head dimensions; they cannot change static validation, collisions, solver results or heart deductions.

Arrow selection uses one delegated `pointerdown` handler. Pointer coordinates are transformed to board coordinates and compared with every path; the nearest centerline within 0.75 cells wins, with arrow ID as deterministic tie-break. The separate click handler only handles controls, so a synthesized touch click cannot activate an arrow twice. The 220 ms action gate suppresses rapid duplicate input and is reset when an animation completes or a level restarts.

The game opens directly into a viewport-filling screen with dynamic viewport sizing and safe-area insets. In development and explicitly flagged QA builds, holding the compact level label for two seconds opens temporary settings; release, cancellation or pointer drift over ten CSS pixels cancels the hold. Enter or Space opens it for keyboard testing. The panel adjusts speed and stroke width, toggles diagnostics, jumps among six levels, restarts and resets QA settings. No settings are persisted. Production builds omit the QA panel chunk.

## Curated QA set

The catalog contains exactly six fixed puzzle definitions, with stable local IDs `shared-board-001` through `shared-board-006`. Each entry includes a title, difficulty and design note. The JSON puzzle definitions are frozen in tests by SHA-256 fingerprints. The catalog runs structure, geometry, variety, dependency and solver checks in automated validation; it does not solve every puzzle during normal page startup.

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

## Progress and deferred features

Completion advances through the six numbered boards in memory. Restart restores the current definition and three hearts. A fresh page load begins at Level 1. The app does not read or write local storage, so previous release data remains unused.

This prototype has no persistent progress, chapter selector, tutorial system, generator, Free Play, black holes, switches, gates, portals, undo, timer or monetization. Revisit these after the current board style has been playtested and approved.

## Branding and delivery

The approved logo master remains at `public/branding/arrow-adventure-official-logo.png`; icon derivatives are in `public/icons/` and PWA metadata is in `public/site.webmanifest`. QA deploys only by selecting a source SHA in the independent QA repository. The production Pages deployment and `main` remain separate.
