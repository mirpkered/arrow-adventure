# Round 11 — Five-Level Compactness Refinement

## Status and scope

Round 11 refines the five approved First Flight puzzles without changing their stable IDs, display numbers, visible-grid dimensions, arrow counts, or movement rules. This document records the initial Round 11 snapshot at commit `e9b3cdde7faf37589f4af98331e73c1048c22a30`, where all five content versions were 2. Round 11A subsequently changed only Level 3 arrow c05's orientation and bumped that level to content version 3; the focused diagnosis is in [Round 11A c05 correction](ROUND_11A_C05.md). The Round 10 catalog remains unchanged in `src/game/archive/adventure-catalog-first-flight-r2.json`; production stays on the approved Round 10 source pending physical review.

The design follows the supplied density principles: short, medium, and winding routes share a compact field, with neighboring paths turning near each other. The accepted catalog is original; no exact screenshot layout, interface, monetization, or artwork was copied.

## Authoring approach

The authoring helper, `scripts/authoring/freeze-round11-catalog.mjs`, uses deterministic per-level seeds to construct a path forest over the complete true-visible-grid lattice. The authoring-time edge-selection pass prefers turns while creating vertex-disjoint, non-branching paths. Each connected route becomes one arrow with a stable ID. This produces multiple distinct routes around the same board rather than dividing one continuous serpentine path into arrow fragments.

The helper is only a candidate authoring tool. Adventure Mode loads the checked-in JSON. Accepted definitions have explicit grid spacing 1, zero offset, integer intersections, orthogonal unit segments, and no hidden half-step routes. Each arrow is validated with the same self-clearance, swept movement, exit, and stationary collision rules as gameplay. Final arrow orientation is frozen in the JSON and protected by fingerprints.

## Before and after

“Adjacent coverage” uses a one-cell centerline threshold, the next valid spacing on the true visible lattice. The original Round 10 and new paths both generally sit one grid unit from their nearest neighbor; Round 11's main gains are longer occupied routes, more repeatedly interleaved arrow pairs, more close segment contacts, and reduced sampled interior gaps. Metrics support visual review and do not replace it.

| Level | Grid / arrows | Route units R10 → R11 | Interleaved pairs R10 → R11 | Close segment contacts R10 → R11 | Blocking links R10 → R11 | Safe openings R10 → R11 | Dependency depth R10 → R11 | Adjacent path coverage R10 → R11 | Large-gap samples R10 → R11 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 — First Steps | 5×5 / 5 | 21 → 31 | 1 → 3 | 45 → 71 | 4 → 4 | 2 → 2 | 4 → 4 | 95.2% → 96.8% | 0% → 0% |
| 2 — Close Quarters | 6×6 / 8 | 26 → 41 | 2 → 8 | 49 → 102 | 7 → 9 | 3 → 3 | 3 → 5 | 96.2% → 95.1% | 0.69% → 0% |
| 3 — Winding Paths | 7×7 / 10 | 36 → 54 | 4 → 9 | 72 → 147 | 10 → 13 | 3 → 3 | 6 → 5 | 94.4% → 94.4% | 0% → 0% |
| 4 — The Weave | 7×8 / 12 | 47 → 60 | 6 → 9 | 122 → 178 | 13 → 16 | 4 → 4 | 5 → 8 | 95.7% → 100% | 0.67% → 0% |
| 5 — First Challenge | 8×8 / 15 | 55 → 66 | 7 → 11 | 144 → 206 | 23 → 28 | 3 → 3 | 6 → 9 | 96.4% → 98.5% | 0% → 0% |

Nearest distinct-path spacing for Round 11 is 1 cell at the minimum, 10th percentile, and median in all five levels; the 90th percentile is also 1 cell for every level. Grid-adjacent coverage is based on path length within 1.01 cells of another arrow. Internal large-gap samples are measured at 0.25-cell samples farther than 1.5 cells from every arrow, inside the authored rectangular footprint.

Every visible-grid intersection is used by at least one route in the revised layouts: 36/36, 49/49, 64/64, 72/72, and 81/81 from Levels 1–5. Round 10 used 26/36, 34/49, 46/64, 59/72, and 70/81. Exit-direction counts (east / west / north / south) are: Level 1 `2 / 2 / 1 / 0`; Level 2 `2 / 2 / 2 / 2`; Level 3 `3 / 1 / 4 / 2`; Level 4 `4 / 1 / 2 / 5`; Level 5 `5 / 2 / 5 / 3`. Round 11 has 0 diagonal segments. The new Level 1 is intentionally north/west weighted to keep its introductory paths legible.

Round 11 route lengths:

1. `[6, 7, 9, 7, 2]`
2. `[3, 3, 8, 7, 6, 6, 7, 1]`
3. `[6, 4, 7, 4, 7, 6, 7, 5, 7, 1]`
4. `[5, 1, 1, 7, 8, 6, 8, 6, 5, 5, 4, 4]`
5. `[4, 4, 6, 7, 2, 3, 5, 7, 5, 4, 7, 5, 5, 1, 1]`

The routes are orthogonal. Across the catalog, every direction is represented; Levels 2–5 use all four cardinal exits, while introductory Level 1 uses three. The preserved opening-move counts maintain the previous teaching curve. Level 3's dependency depth is one wave lower than Round 10, while its interleaving and blocking-link counts increase; that trade-off avoids making every dimension rise mechanically.

## Geometry, gameplay and exhaustive solvability

`validateCuratedLevels`, individual-arrow validation, `solveLevel`, and `auditReachableStates` run against the same full-body collision simulator used by gameplay. Each deterministic solver sequence was replayed arrow by arrow through `simulateMove`. Each complete state audit visited every reachable remaining-arrow subset, found one terminal empty-board state, and found no deadlock or dependency cycle.

| Level | Reachable states | Legal removal transitions | Initial safe arrows | Deadlocks / cycles |
| --- | ---: | ---: | ---: | ---: |
| 1 | 8 | 9 | 2 | 0 / 0 |
| 2 | 21 | 35 | 3 | 0 / 0 |
| 3 | 70 | 165 | 3 | 0 / 0 |
| 4 | 56 | 124 | 4 | 0 / 0 |
| 5 | 66 | 137 | 3 | 0 / 0 |
| **Total** | **221** | **470** | — | **0 / 0** |

The exact audit is complete and below the engine's 20-arrow cap. Stationary paths do not intersect, self-clearance and swept self-motion validation pass, and arrows retain at least one-cell nearest-path clearance. Strokes, hit tolerance, pinch zoom, pan, animation speed, hearts, and save behavior are unchanged.

## Save compatibility

Game save schema v4 records `catalogVersion` and the selected level's `contentVersion`. Existing Round 10 schema-v3 saves have no route-content binding. Migration preserves known completed-level IDs and the selected stable level ID. If that saved level is incomplete, the changed board restarts with its full arrow set, three hearts, and no old red marks; a completed level keeps its completion credit. The v3 source key is removed only after a successful v4 write. Appearance and audio settings are stored separately and are not changed. Production and QA storage namespaces remain independent.

The migration is idempotent: after the v4 write, later loads read that record. Malformed saves remain available for recovery and are ignored. Unknown retired catalog IDs are not mapped to the new levels.

## Previews

All images are rendered from the committed catalog coordinates with the current monochrome body, arrowhead, tail marker, light background, and true-grid styling. Phone renders are static 390×844 composition-fit previews, not browser screenshots or physical iPhone captures.

- [Round 11 contact sheet](previews/round-11/contact-sheet.png)
- [Detailed Level 4 and 5 comparison](previews/round-11/levels-4-5-detailed-comparison.png)

| Level | Full board | 390×844 portrait | Round 10 vs Round 11 |
| --- | --- | --- | --- |
| 1 — First Steps | [PNG](previews/round-11/level-1-full.png) | [PNG](previews/round-11/level-1-iphone-390x844.png) | [PNG](previews/round-11/level-1-round10-vs-round11.png) |
| 2 — Close Quarters | [PNG](previews/round-11/level-2-full.png) | [PNG](previews/round-11/level-2-iphone-390x844.png) | [PNG](previews/round-11/level-2-round10-vs-round11.png) |
| 3 — Winding Paths | [PNG](previews/round-11/level-3-full.png) | [PNG](previews/round-11/level-3-iphone-390x844.png) | [PNG](previews/round-11/level-3-round10-vs-round11.png) |
| 4 — The Weave | [PNG](previews/round-11/level-4-full.png) | [PNG](previews/round-11/level-4-iphone-390x844.png) | [PNG](previews/round-11/level-4-round10-vs-round11.png) |
| 5 — First Challenge | [PNG](previews/round-11/level-5-full.png) | [PNG](previews/round-11/level-5-iphone-390x844.png) | [PNG](previews/round-11/level-5-round10-vs-round11.png) |

## Review and release safety

Work is isolated on `round-11/compactness-refinement`. The temporary QA-to-production synchronizer checks only `round-10/five-level-foundation`; this branch is not a source branch for that workflow. The active Adventure catalog in this branch can be deployed manually to the independent QA repository by its candidate-SHA workflow. Do not merge or copy Round 11 to production before the developer's iPhone review and approval. Physical iPhone validation remains outstanding.
