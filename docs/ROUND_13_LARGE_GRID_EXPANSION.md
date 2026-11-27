# Round 13 — Large-Grid Expansion

## Scope and release status

Round 13 keeps the approved Round 11A opening five, retires QA as the current test host, and makes `main` the only production deployment source. Levels 6, 7, and 8 have been released to production. Level 8 — Grand Weave is the 14×14 stretch level. The production release at source `e89fb976453ee19ec7f0abd025cb97c8b504560a` completed successfully in [workflow run 45948865219](https://github.com/mirpkered/arrow-adventure/actions/runs/45948865219); independent live verification confirmed the same source SHA, HTTP 200, and nine required assets.

The QA Pages site and scheduled QA-to-production synchronizer are paused. The QA repository and history are retained. `ENABLE_TEMPORARY_PRODUCTION_SYNC` is `false`, and its workflow is disabled. Feature work stays on `round-13/large-grid-expansion`; direct production release occurs only after validation and normal fast-forward promotion to `main`. See [baseline and recovery record](ROUND_13_BASELINE.md) and [release procedure](QA_ENVIRONMENT.md).

## Active production levels

### Level 6 — Larger Weave

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
| Interleaved pairs / close segment contacts | 17 / 317 |
| Blocking links / dependency depth | 31 / 5 |
| Initially removable | 5 |
| Large-gap ratio | 0% at the authoring sampler threshold |
| Solvability method | Exact reachable-state audit: 2,206 states, 9,163 legal transitions, 1 terminal, 0 deadlocks, 0 cycles |

### Level 7 — The Deep Weave

| Property | Result |
| --- | ---: |
| Stable ID / content version | `first-flight-007` / 1 |
| Visible grid | 12×12 cells (13×13 intersections) |
| Arrows | 30 |
| Authoring seed | 14825 |
| Total route length | 139 units |
| Route-length distribution | 1, 1, 2, 2, eight routes of length 3, 4, 4, three routes of length 5, five routes of length 6, eight routes of length 7 |
| Occupied intersections | 169 / 169 |
| Adjacent-grid path coverage | 98.56% |
| Nearest distinct-path spacing | minimum / median 1 unit |
| Interleaved pairs / close segment contacts | 24 / 461 |
| Blocking links / dependency depth | 66 / 7 |
| Initially removable | 4 |
| Large-gap ratio | 0% at the authoring sampler threshold |
| Solvability method | Complete static blocker-DAG certificate; 30-step witness replayed through gameplay simulation |

### Level 8 — Grand Weave (14×14 stretch release)

| Property | Result |
| --- | ---: |
| Stable ID / content version | `first-flight-008` / 1 |
| Visible grid | 14×14 cells (15×15 intersections) |
| Arrows | 40 |
| Authoring seed | 17727 |
| Total route length | 185 units |
| Route-length distribution | 4 of length 1, 8 of length 3, 5 of length 4, 9 of length 5, 6 of length 6, 8 of length 7 |
| Exit directions | 11 east, 10 west, 6 north, 13 south; no diagonal segments |
| Occupied intersections | 225 / 225 |
| Adjacent-grid path coverage | 99.46% |
| Nearest distinct-path spacing | minimum, 10th percentile, median and 90th percentile all 1 unit |
| Interleaved pairs / close segment contacts | 36 / 629 |
| Blocking links / dependency depth | 95 / 11 |
| Initially removable | 9 |
| Large-gap ratio | 0% at the authoring sampler threshold |
| Isolated short route | `g05` is a one-unit immediate exit with no measured interleaving/blocker link; disclosed rather than hidden |
| Solvability method | Complete static blocker-DAG certificate; 40-step witness replayed through gameplay simulation; no cycles |

All three large boards are authored as deterministic partitions of their full visible intersection lattice into orthogonal paths, then oriented to form static blocker structures. The generator is an offline candidate aid only; runtime Adventure Mode reads frozen JSON routes. The five Round 11A openings remain unchanged.

## Solver scalability and guarantees

The exact reachable-state enumerator remains capped at 20 arrows. It explores all reachable remaining-arrow subsets, records legal transitions and deadlocks, and throws above the cap rather than silently truncating. Level 6 remains under the cap and gets the exact audit. Levels 7 and 8 do **not** receive an exact subset enumeration.

For the current static-obstacle, whole-arrow removal rules, the blocker graph is a complete alternative proof. An edge A→B exists when the gameplay `simulateMove` says B alone prevents A from exiting. Collision against multiple stationary arrows is the union of their individual swept collisions, so a move is legal exactly when its remaining induced graph has no outgoing blocker edge. Successful movement only removes an obstacle. A blocker DAG has a sink in every nonempty induced subgraph; removing any legal sink leaves another DAG, so every legal removal order can still complete. A cycle yields a reachable deadlock witness by repeatedly peeling legal sinks. This proof does not cover switches, gates, portals, moving hazards, or future state-changing rules without a new proof.

Regression tests compare the graph legality model against multi-obstacle simulation across reachable subsets of representative small levels, test cycles and deadlock witnesses, and validate larger fixtures without enumerating `2^n` subsets. The active 30- and 40-arrow definitions receive full geometry validation, graph construction, complete removal witnesses, gameplay-simulator replay, frozen fingerprints, progression and viewport tests. The graph method remains a mathematical certificate, not a heuristic, but is distinct from exhaustive state counts.

## Benchmark snapshot

Single-process Windows Node/Vite authoring measurements (not a browser or iPhone benchmark):

| Level | Grid / arrows | Blocker graph construction | Certificate + replay | Exact audit | Solver witness | 100 full-board move checks |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 5 | 8×8 / 15 | 0.40 s | 0.20 s | 0.49 ms / 66 states | 0.10 ms | 216 ms |
| 6 | 10×10 / 20 | 0.86 s | 0.35 s | 11.53 ms / 2,206 states | 0.21 ms | 115 ms |
| 7 | 12×12 / 30 | 1.75 s | 0.81 s | not run; above cap | 0.12 ms | 527 ms |
| 8 | 14×14 / 40 | 3.18 s | 1.29 s | not run; above cap | 0.27 ms | 763 ms |

All eight catalog levels took 14.56 seconds for the benchmark validation pass. Process RSS sampled before/after the harness was about 95 MB / 156 MB; this is not a peak guarantee or a browser heap measurement. Level 8 full-board simulation averaged about 7.63 ms per call over 100 calls on this Windows Node environment. Cache-cold graph construction is an offline authoring validation; production does not run it on every animation frame. Physical mobile performance still requires device testing.

## Production-only release transition

- Initial production/main: `84089f88ff1edddd4776435984c94c0a220e825f`.
- Approved Round 11A base: `7bf997aecab181eb42eef4f35332e5ae4129878a`.
- Checkpoint before workflow transition: `checkpoint/round-13-before-production-transition`.
- Milestone A production-only workflow + Round 11A deployment: `56de1742b739fc8d2f78cd73d9faaebf2c7aa505`, [run 45938736123](https://github.com/mirpkered/arrow-adventure/actions/runs/45938736123).
- Checkpoint before Level 6 release: `checkpoint/round-13-before-level-6-production`.
- Milestone B Level 6 deployment: `b924ba7a1272b6ca7014a8419987c8afb1327d9e`, [run 45944238296](https://github.com/mirpkered/arrow-adventure/actions/runs/45944238296).
- Checkpoint before Level 7 release: `checkpoint/round-13-before-level-7-production`.
- Milestone C Level 7 deployment: `688232a0e0c51f1dea05cea89a12ed270560a475`, [run 45945656708](https://github.com/mirpkered/arrow-adventure/actions/runs/45945656708).
- Checkpoint before Level 8: `checkpoint/round-13-before-level-8-experiment`.
- Milestone D Level 8 deployment: `e89fb976453ee19ec7f0abd025cb97c8b504560a`, [run 45948865219](https://github.com/mirpkered/arrow-adventure/actions/runs/45948865219). The run passed tests, typecheck, production build and artifact checks, then deployed and verified the live app. Independent verification returned source SHA `e89fb976453ee19ec7f0abd025cb97c8b504560a`, page HTTP 200, and nine assets.

The production Actions run emitted a non-blocking GitHub warning that the current `checkout@v4`, `configure-pages@v5`, `setup-node@v4`, and `upload-artifact@v4` actions target Node.js 20 and runners are forcing Node.js 24. The run completed successfully; action-version maintenance should be scheduled before GitHub removes compatibility.

The production workflow checks the exact source revision, installs with `npm ci`, runs the full tests, typecheck and `/arrow-adventure/` build, verifies QA-only code is absent, stamps source metadata, deploys Pages, then checks the live page and assets. No QA deployment record or workflow is required. The separate QA repository and run history are retained for possible restoration.

## Previews

All files in [`docs/previews/round-13-large-grid/`](previews/round-13-large-grid/README.md) use the frozen catalog routes and current monochrome styling. The SVG previews are generated by `scripts/authoring/render-round13-previews.mjs`; the companion PNGs are static renderer renders from the same coordinates, not Safari screenshots.

- [Eight-level contact sheet (SVG)](previews/round-13-large-grid/contact-sheet.svg) · [PNG](previews/round-13-large-grid/contact-sheet.png)
- Level 6: [full](previews/round-13-large-grid/level-6-full.svg), [390×844](previews/round-13-large-grid/level-6-iphone-390x844.svg), [IDs](previews/round-13-large-grid/level-6-arrow-ids.svg), [grid coverage](previews/round-13-large-grid/level-6-grid-coverage.svg), [density](previews/round-13-large-grid/level-6-density-summary.svg)
- Level 7: [full](previews/round-13-large-grid/level-7-full.svg), [390×844](previews/round-13-large-grid/level-7-iphone-390x844.svg), [IDs](previews/round-13-large-grid/level-7-arrow-ids.svg), [grid coverage](previews/round-13-large-grid/level-7-grid-coverage.svg), [density](previews/round-13-large-grid/level-7-density-summary.svg)
- Level 8: [full](previews/round-13-large-grid/level-8-full.svg), [390×844](previews/round-13-large-grid/level-8-iphone-390x844.svg), [IDs](previews/round-13-large-grid/level-8-arrow-ids.svg), [grid coverage](previews/round-13-large-grid/level-8-grid-coverage.svg), [density](previews/round-13-large-grid/level-8-density-summary.svg)

The renderer preview is a static, geometry-faithful rendering. Browser automation was unavailable in this run; no Safari screenshot or physical iPhone verification is claimed for Levels 6–8.
