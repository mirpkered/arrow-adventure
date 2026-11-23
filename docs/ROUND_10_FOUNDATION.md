# Round 10 — Five-Level True-Grid Foundation

## Status

Round 10 replaces the active development Adventure catalog with five new frozen levels under catalog version `first-flight-r2-true-grid`. It is prepared for isolated QA review. Production `main` remains at the previous six-level release and must not be updated until the developer reviews these five levels on an iPhone.

The retired ten-level Round 9 candidate catalog is preserved at `src/game/archive/adventure-catalog-first-flight-r1.json`; its canonical JSON fingerprint matches the pre-reset active catalog. The older six-level reference catalog remains in `src/game/archive/catalog-round8.ts`. Round 9H remains an unchanged QA prototype at `src/game/prototypes/round9h-square-true-7.json` with its original fingerprint and regression tests.

## Visible-grid contract

Round 10 levels declare:

```json
{"spacing":1,"origin":{"x":0,"y":0},"pathOffset":0,"includeOuterBoundary":true}
```

An `W×H` level therefore renders `W+1` vertical and `H+1` horizontal grid lines, forming exactly `W×H` visible cells. Routes use only integer intersections from `(0,0)` through `(W,H)`. The active five levels use horizontal and vertical unit steps. The shared engine continues to accept exact 45-degree diagonals for future authored levels. Existing content without an explicit grid specification keeps its original legacy half-unit interpretation; no historical puzzle was reinterpreted.

## Curated levels and audit

| Level | Title | Visible cells | Arrows | Route units | Interleaved pairs | Blocking links | Safe openings | Dependency depth | Exact states / transitions | Sampled internal gap area |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | First Steps | 5×5 | 5 | 21 | 1 | 4 | 2 | 4 | 10 / 13 | 0% |
| 2 | Close Quarters | 6×6 | 8 | 26 | 2 | 7 | 3 | 3 | 52 / 128 | 0.69% |
| 3 | Winding Paths | 7×7 | 10 | 36 | 4 | 10 | 3 | 6 | 34 / 63 | 0% |
| 4 | The Weave | 7×8 | 12 | 47 | 6 | 13 | 4 | 5 | 172 / 512 | 0.67% |
| 5 | First Challenge | 8×8 | 15 | 55 | 7 | 23 | 3 | 6 | 239 / 714 | 0% |

The sampled-gap column checks the authored rectangular footprint at 0.25-cell samples and labels a sample as a gap when it is more than 1.5 cells from every centerline. It is descriptive rather than an aesthetic pass score. Every level has a minimum, 10th-percentile, median, and 90th-percentile neighboring-path spacing of one full cell. Route lengths are frozen and tested:

1. `[5, 2, 6, 3, 5]`
2. `[6, 4, 4, 2, 3, 3, 2, 2]`
3. `[5, 3, 4, 5, 3, 3, 2, 3, 6, 2]`
4. `[7, 3, 2, 4, 3, 5, 5, 7, 4, 2, 3, 2]`
5. `[7, 3, 2, 5, 3, 5, 5, 7, 4, 2, 3, 2, 2, 2, 3]`

The total is 50 arrows and 185 route units. The complete audit visited 507 unique reachable board states and 1,430 legal removals, reached each empty board exactly once, and reported no deadlocks or dependency cycles. The deterministic solver sequence for each level was replayed through the same movement simulator used by gameplay. All routes passed grid alignment, self-clearance, exit, stationary collision, and swept-motion geometry validation.

Level 5 deliberately extends the visual corridor language introduced by Level 4, while adding the right-edge route and a dependency chain through `e15 → e13 → e08 → e14`. It is a progression in the same First Flight chapter rather than a completely separate silhouette style; the contact sheet is provided so that the developer can judge whether the similarity is acceptable before production release.

## Previews

- [Five-level contact sheet](previews/round-10/contact-sheet.png)
- Level 1: [full board](previews/round-10/level-1-full.png) · [390×844 portrait fit](previews/round-10/level-1-iphone-390x844.png)
- Level 2: [full board](previews/round-10/level-2-full.png) · [390×844 portrait fit](previews/round-10/level-2-iphone-390x844.png)
- Level 3: [full board](previews/round-10/level-3-full.png) · [390×844 portrait fit](previews/round-10/level-3-iphone-390x844.png)
- Level 4: [full board](previews/round-10/level-4-full.png) · [390×844 portrait fit](previews/round-10/level-4-iphone-390x844.png)
- Level 5: [full board](previews/round-10/level-5-full.png) · [390×844 portrait fit](previews/round-10/level-5-iphone-390x844.png)

The portraits are renderer-generated static previews using the gameplay stroke, arrowhead, tail, grid, and composition-fit dimensions. They are not browser captures or physical-device screenshots. The last physical iPhone test was the developer's Round 9H test; Round 10 still needs its own iPhone review.

## Save reset

Round 10 changes Adventure progress to save schema v3 and catalog version `first-flight-r2-true-grid`. Startup removes only the previous environment-specific game keys (`arrow-adventure.{production|qa}.game.v1/.v2`) and the retired legacy game-save keys. It does not remove appearance or audio preferences. Old level completions are not mapped to the new levels. New stable board states continue to save by level ID; animation frames are never persisted. QA and production use different storage namespaces.

## Reproducible authoring and limits

`scripts/authoring/freeze-round10-catalog.mjs` serializes the five committed route definitions into the runtime JSON. It is an authoring-time, deterministic freeze helper; the game never generates Adventure Mode levels at runtime. The exact JSON is protected by SHA-256 regression tests. Change a published route only through deliberate review, a content-version increment, regenerated fingerprints, and a complete geometry/state audit.

The exhaustive state audit currently supports at most 20 arrows per board; all Round 10 levels are below that cap, and this audit was not truncated. Visual path density, interleaving counts, and the portrait previews still require human judgment. The full Round 10 sequence has not yet been physically played on an iPhone.
