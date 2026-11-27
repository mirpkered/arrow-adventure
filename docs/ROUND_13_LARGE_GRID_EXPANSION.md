# Round 13 — Large-Grid Expansion

## Scope and release status

Round 13 makes `main` the sole production release source and expands the approved Round 11A First Flight campaign without replacing its opening puzzles. The first larger-board release appends a frozen Level 6. A 12×12 Level 7 candidate is being developed separately and is not included in the six-level production catalog at this milestone.

The QA Pages site is paused, its repository retained, and the scheduled QA-to-production synchronizer disabled. Feature work remains on `round-13/large-grid-expansion`; production releases occur only after validation and a normal promotion to `main`. See [baseline/recovery record](ROUND_13_BASELINE.md) and [release procedure](QA_ENVIRONMENT.md).

## Level 6 — Larger Weave

| Property | Result |
| --- | ---: |
| Stable ID / content version | `first-flight-006` / 1 |
| Visible grid | 10×10 cells (11×11 intersections) |
| Arrows | 20 |
| Authoring seed | 13309 |
| Total route length | 101 units |
| Route-length distribution | 1, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8 |
| Occupied intersections | 121 / 121 |
| Adjacent-grid path coverage | 98.02% |
| Nearest distinct-path spacing | minimum 1; median 1 unit |
| Interleaved arrow pairs / close segment contacts | 17 / 317 |
| Blocking links / dependency depth | 31 / 5 |
| Initially removable | 5 |
| Large-gap ratio | 0% at the authoring sampler threshold |
| Exact reachable-state audit | 2,206 states; 9,163 legal transitions; 1 terminal; 0 deadlocks; 0 cycles |
| Geometry / solver replay | passed; each arrow is grid-aligned and orthogonal; solution replayed with `simulateMove` |

The puzzle is authored as a deterministic partition of the complete 10×10-cell visible intersection lattice into 20 orthogonal routes, then oriented to form an acyclic blocker structure. The generator is an offline candidate aid only; runtime Adventure Mode reads the frozen JSON routes. Metrics screen weak arrangements but do not replace visual review.

## Solver scalability and guarantees

The exact enumerator remains explicitly capped at 20 arrows. At the cap it explores reachable subsets (Level 6 visits 2,206 of the possible 1,048,576 subsets), recording legal transitions and deadlocks. It throws above the cap rather than silently truncating.

Round 13 adds a second, distinct complete method for the current static-obstacle removal-only rules. The blocker graph is built by calling the same `simulateMove` used by gameplay for every ordered pair of arrows. There is an edge A→B when B alone prevents A from leaving. A move against a set of stationary arrows is blocked exactly when at least one individual arrow blocks it, because collision against static geometry is a union. Successful moves only remove obstacles. Therefore a blocker DAG has a sink in every nonempty induced remaining graph; every legal removal leaves an induced DAG, so all reachable removal orders still complete. A cyclic graph yields a deadlock witness after repeatedly removing legal sinks. This is a complete graph proof, not a subset enumeration or a heuristic. It is invalid for gates, switches, portals, moving hazards, or other state-changing rules until separately proved.

Regression tests compare graph legality with full multi-obstacle simulation for all reachable subsets of a representative authored level, verify cycle/deadlock witnesses, and validate a 21-arrow graph fixture without enumerating `2^21` states. Level 6 itself remains under the old cap and receives the exact audit.

## Authoring and visual previews

The deterministic full-grid route partition and orientation helper live under `src/game/authoring/`. They are offline-only candidate tools. Frozen definitions remain in `src/game/adventure-catalog.json` with stable IDs, content versions, explicit true-grid specifications, and regression fingerprints.

Renderer-produced previews use the committed coordinates and approved thin monochrome styling. SVG files are the source previews; available PNGs are derived renders. Phone previews are static renderer output, not Safari screenshots.

- [Level 6 full board](previews/round-13-large-grid/level-6-full.svg)
- [Level 6 390×844 portrait](previews/round-13-large-grid/level-6-iphone-390x844.svg)
- [Level 6 arrow IDs](previews/round-13-large-grid/level-6-arrow-ids.svg)
- [Level 6 grid / route coverage](previews/round-13-large-grid/level-6-grid-coverage.svg)
- [Level 5 → Level 6 density comparison](previews/round-13-large-grid/level-6-density-summary.svg)
- [Current campaign contact sheet](previews/round-13-large-grid/contact-sheet.svg)

The checked-in preview README gives the complete list and states the rendering limitations. [Level Authoring](LEVEL_AUTHORING.md) documents large-grid composition and proof requirements.

## Validation and release record

The Level 6 release gate includes `npm ci`, all Vitest tests, `npm run typecheck`, the production build at `/arrow-adventure/`, production artifact exclusion checks, catalog/geometry validation, the exact Level 6 state audit, save/progression tests, and `git diff --check`. Detailed command results, commit SHAs, production run, and viewports are recorded in the Round 13 delivery report after each promotion. New large content still requires physical iPhone playtesting after deployment; automated fitting and touch selection do not claim a physical-device test.

## Next milestone

Level 7 targets a dense 12×12 weave with more than 20 arrows. The first candidate has 30 arrows, 139 route units, 169/169 occupied intersections, 24 interleaved pairs, 66 blocker links, dependency depth 7, and 4 initial safe moves. Its static blocker-DAG certificate and full simulator replay passed during development, but it is not part of this Level 6 release. It must pass its own tests, production build, artifact exclusion check, renderer/browser review, and production deployment gate before being appended.

A 14×14 puzzle is a stretch experiment only after Level 7 stabilizes. A 16×16 board is research; no support guarantee is claimed yet.
