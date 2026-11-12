# Round 9F — Compact 7×7 Square Weave

## Status and isolation

Round 9F adds one experimental prototype, `prototype-square-7`, content version 1, in [round9f-square-7.json](../src/game/prototypes/round9f-square-7.json). Work starts from `4c7b4a4761bc483f37825c99b09fade5f9d657ae` on `round-9/adventure-rebuild`; the recoverable `checkpoint/round-9f-before-compact-square` branch points to that same baseline. It is a new 7×7 composition, not a scaled copy of the 15×15 Round 9E board. Round 9E remains unchanged. Round 9F is not in the active Adventure catalog or the QA Prototype Review selector, and has not been deployed to QA or production. No progress or persistence code changed.

The routes were composed as one compact square field, explored with deterministic seed 8, and frozen as explicit JSON. The centerlines were reviewed first without heads or tail marks; then final arrow directions and the game-style render were reviewed. There is no runtime level generation. Puzzle SHA-256: `ef5f7d40106048add0a7b753d58213719874e3b77650dc10a711c63aa3ccd8a0`.

## Geometry

The logical board is exactly 7×7 cells. It uses the existing visible 0.5-unit grid and the engine’s path-local coordinates; adding `PATH_POINT_OFFSET` (0.5) maps each vertex to a displayed grid intersection. Every segment is one board unit and horizontal or vertical. The paths occupy local bounds x=0..6.5, y=0..6.5 and use the existing 0.12-unit body stroke, arrowhead, tail marker, collision envelope, and nearest-path touch selection. No collision or touch tolerances were changed.

The 15 routes use a deliberately mixed, small-board length classification:

| Band | Route lengths (board units) | Count |
| --- | --- | ---: |
| Long | 5, 5, 5, 6 | 4 |
| Medium | 4, 4, 4, 4, 4, 4 | 6 |
| Short | 2, 2, 2, 3, 3 | 5 |

The turn counts vary from zero through four. Short arrows form playable corridors alongside longer hooks and winding paths; none are decorative. Exit headings include north, west, and east.

## Composition measurements

Measurements use the shared geometry utilities; they describe the candidate and do not replace the visual review.

* Total route length: 57 units; route-length/board-area ratio: 1.1633.
* Path bounds cover the complete 7×7 coordinate footprint.
* 100% of route length has a distinct path within 0.75 units.
* Minimum, 10th-percentile, and median distinct-path spacing: 0.5 units.
* Parallel neighboring corridor length: 20.5 units.
* Interleaved arrow pairs: 17; close segment contacts: 310.
* At a 0.125-unit sampling step, only 0.70% of board samples are farther than 1.25 units from every centerline.

The full-board preview shows the actual 7×7 geometry at an identical square scale; the phone preview shows the same paths within a 390×844 portrait composition. The corridor-only preview is the headless path-planning view.

## Movement and exact state validation

The frozen level uses `validateLevel`, `simulateMove`, `solveLevel`, and `auditReachableStates` without a prototype-specific collision model. Its 18 directed blocking relationships form a dependency depth of 5, with 7 initially removable arrows. A complete solver route is replayed through `simulateMove` in the regression test.

The exact reachable-state audit visits 1,744 remaining-arrow states and 8,464 successful-removal transitions. It reaches the empty board, reports no deadlocks or dependency cycles, and has seven initial legal moves. Since the audit is exhaustive over all successful-removal subsets, this is a complete state result for the frozen 15-arrow board, not a sampled or bounded estimate.

The regression test also freezes the puzzle fingerprint, checks all 15 paths for exact grid alignment and orthogonal one-unit steps, validates stationary/self geometry, verifies selection at every route, and exercises fitted view, zoom, pan, and fit reset at compact phone, phone portrait, and landscape viewport sizes.

## Previews

The review images are committed under `docs/previews/round-9f/`:

* [Corridor plan](previews/round-9f/corridor-plan.png)
* [Full 7×7 game-style board](previews/round-9f/square-weave-7.png)
* [390×844 portrait preview](previews/round-9f/square-weave-7-iphone.png)
* [Arrow-ID diagnostic](previews/round-9f/square-weave-7-diagnostic.png)

Regenerate them on Windows with:

```powershell
pwsh -NoProfile -File scripts/render-round9f-previews.ps1 -CorridorPlan
pwsh -NoProfile -File scripts/render-round9f-previews.ps1
```

The renderer is a static preview tool using the same board coordinates and visible dimensions. The portrait image is not a browser screenshot and cannot verify physical touch behavior.

## Review boundary

The automated selection and viewport tests are code-level checks only. No browser or physical iPhone playtest was performed for Round 9F. This prototype remains separate until it has been reviewed on device; it must not be promoted by adding it to the Adventure catalog implicitly.
