# Round 9G — Compact Interwoven Square

## Status and isolation

Round 9G adds one frozen experimental prototype, `prototype-square-7-weave`, content version 1, in [round9g-square-7-weave.json](../src/game/prototypes/round9g-square-7-weave.json). It starts from the Round 9F development state at `715f6fca08aed510c75e53df02efd1e69e3113a8`; the recoverable `checkpoint/round-9g-before-interwoven` branch points to that baseline. Round 9F remains unchanged and separately tested. This board is not in the Adventure catalog or QA Prototype Review selector. The active catalog, runtime generation, player progress, collision tolerances, and deployments were not changed.

The corridor layout was explored offline with deterministic seed 32. Centerlines were reviewed without arrowheads or tail markers before a separate direction-orientation search selected a collision-safe, acyclic assignment. The exact coordinates are now frozen in JSON; the game does not generate this puzzle at runtime. The puzzle SHA-256 is `cdc93584f39b2483e69294053197dd848abc2a512ae932ea7059bf2bf6b839ba`.

## Geometry and visual change

The puzzle is exactly 7×7 cells with 15 distinct arrows. All path vertices use the existing displayed half-unit grid, all segments are horizontal or vertical, and each segment is one board unit long. The occupied coordinate bounds are x=0..6.5 and y=0..6.5. The existing 0.12-unit body stroke, arrowheads, tail markers, collision envelope, and touch selection are unchanged.

The route-length distribution matches Round 9F: 4 long routes of 5–6 units, 6 medium routes of 4 units, and 5 short routes of 2–3 units. This keeps the accepted small-board scale and makes the comparison about the path shapes. Round 9G uses 39 right-angle turns across the 15 arrows (Round 9F has 24). The routes include nested hooks and stair-step bends across the upper-left, center, and lower regions; short paths fill internal pockets. Exits use all four cardinal directions: north 2, east 4, south 3, west 6.

| Measurement | Round 9F | Round 9G |
| --- | ---: | ---: |
| Arrows / board | 15 / 7×7 | 15 / 7×7 |
| Total path length | 57 | 57 |
| Path length adjacent to another path within 0.75 units | 100% | 96.49% (55 of 57 units) |
| Minimum / median distinct-path spacing | 0.5 / 0.5 | 0.5 / 0.5 |
| Parallel neighboring corridor length | 20.5 | 18 |
| Interleaved arrow pairs | 17 | 17 |
| Coordinated nearby bend pairs | 3 | 10 |
| Board samples farther than 1.25 units from a path | 0.7015% | 0.0638% |

“Coordinated nearby bend pairs” is an additional descriptive measure: two distinct arrows count once when they contain similarly oriented right-angle corners within 1.1 board units. Round 9G has 13 such matching bend instances across 10 distinct arrow pairs. This better distinguishes adjacent turns from straight parallel corridors. The value supports, but does not replace, the matched-scale visual review. The 3.51% of path length outside the 0.75-unit adjacency band is accepted to preserve readable, legal paths; spacing and collision rules were not loosened.

## Dependencies and exact solvability

Validation uses the existing `validateLevel`, `simulateMove`, `solveLevel`, `analyzeLevel`, and `auditReachableStates` implementations. Every arrow passes grid, self-intersection, self-clearance, self-traversal, exit, and stationary-collision validation. The exact reachable-state audit visits 1,512 remaining-arrow states and 6,684 legal removal transitions, reaches one terminal empty-board state, and finds no deadlocks or dependency cycles. The initial state has six legal moves. There are 16 directed blocking dependencies with dependency depth 4. The regression test also replays a complete solution through the actual gameplay movement simulator.

All five requested visual checks are retained as exact-coordinate previews. The 9F and 9G full-size renders use identical scale and styling. The 390×844 image is a generated portrait composition, not a browser screenshot; touch reliability and camera behavior are checked in tests but still need device playtesting.

## Previews

* [Full-size 7×7 board](previews/round-9g/square-weave-7-weave.png)
* [390×844 portrait composition](previews/round-9g/square-weave-7-weave-iphone.png)
* [Arrow-ID diagnostic](previews/round-9g/square-weave-7-weave-diagnostic.png)
* [Corridor-only composition](previews/round-9g/corridor-plan.png)
* [Matched-scale Round 9F / 9G comparison](previews/round-9g/round9f-vs-round9g.png)

Regenerate all images on Windows with:

```powershell
pwsh -NoProfile -File scripts/render-round9g-previews.ps1
```

The renderer reads the committed prototype file and uses the existing Round 9F game-style rendering script, so each image reflects the frozen coordinates. The portrait and comparison renders remain static previews; no physical iPhone test is claimed.

## Review boundary

This is a visual/gameplay experiment only. It was not added to the active game or QA menu, and was not deployed. Review the committed static previews before deciding whether to add it to Prototype Review for on-device testing.
