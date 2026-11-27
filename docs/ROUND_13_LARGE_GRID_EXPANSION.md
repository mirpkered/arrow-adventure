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

## Level 7 — The Deep Weave (development candidate)

| Property | Result |
| --- | ---: |
| Stable ID / content version | `first-flight-007` / 1 |
| Visible grid | 12×12 cells (13×13 intersections) |
| Arrows | 30 |
| Authoring seed | 14825 |
| Total route length | 139 units |
| Sorted route-length distribution | 1, 1, 2, 2, eight routes of length 3, 4, 4, 5, 5, 5, five routes of length 6, eight routes of length 7 |
| Occupied intersections | 169 / 169 |
| Adjacent-grid path coverage | 98.56% |
| Nearest distinct-path spacing | minimum / median 1 unit |
| Interleaved arrow pairs / close segment contacts | 24 / 461 |
| Blocking links / dependency depth | 66 / 7 |
| Initially removable | 4 |
| Large-gap ratio | 0% at the authoring sampler threshold |
| Solvability certificate | complete static blocker DAG; 30-move witness replayed through `simulateMove`; no cycles |

The 30-route composition occupies the complete 12×12 visible lattice with mixed short, medium and longer orthogonal paths. It was generated offline from seed 14825, geometrically validated, and frozen in the development catalog. It remains a development candidate until the production milestone gate and live deployment complete.

## Benchmark snapshot

Single-process Windows authoring measurements (Node/Vite SSR, no browser session):

| Level | Blocker graph build | Complete graph certificate + replay | Exact audit | Solver witness | 100 full-board move simulations |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5 — 15 arrows | 0.33 s | 0.16 s | 0.5 ms, 66 states | 0.11 ms | 0.30 s |
| 6 — 20 arrows | 0.91 s | 0.35 s | 11.5 ms, 2,206 states | 0.27 ms | 0.14 s |
| 7 — 30 arrows | 1.58 s | 0.72 s | not run (above cap) | 0.11 ms | 0.63 s |

All current catalog levels together took 9.31 seconds for this benchmark. RSS sampled before/after the harness rose from about 94 MB to 154 MB; this is process-level Vite/Node memory, not an isolated browser heap measurement or a peak guarantee. A Level 7 gameplay move simulation averaged about 6.3 ms over the repeated 100-call sample. Cache-cold blocker construction is offline validation; production does not run the full authoring audit on every frame or tap.

The Level 7 proof is a DAG certificate, not exhaustive subset enumeration. The exact auditor still rejects more than 20 arrows. The 14×14 experiment remains deferred until the Level 7 candidate has passed production and physical play review.

## Next milestone

Promote Level 7 only after its complete suite, TypeScript, production build, artifact exclusion checks, geometry/certificate tests, viewport checks, and source traceability all pass. A 14×14 board is a stretch experiment after that milestone stabilizes. A 16×16 board is research; no support guarantee is claimed yet.
