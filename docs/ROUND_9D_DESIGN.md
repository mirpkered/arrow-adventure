# Round 9D composition prototypes and adaptive board fit

## Status and boundary

Round 9D adds five experimental boards to the QA-only Prototype Review list. The active Adventure catalog, its ten development candidates, save behavior, and production game are unchanged. Round 9C prototypes A–C remain available for comparison; the new stable experiment IDs are:

- `round9d-micro-arrow-field` — Prototype D
- `round9d-dense-interwoven-maze` — Prototype E
- `round9d-tree-silhouette` — Prototype F
- `round9d-large-mixed-weave` — Prototype G
- `round9d-framed-composition` — Prototype H

The five image attachments referenced in the Round 9D planning message were not mounted in the execution workspace. The designs were based on the detailed written descriptions included with that request. The resulting boards are original and do not trace another game's paths, branding, or interface.

## Authoring and freezing

The final definitions are in `src/game/prototypes/round9d-prototypes.json`. `scripts/authoring/create-round9d-prototypes.mjs` is the deterministic waypoint authoring source; each authored waypoint segment expands into the displayed half-unit lattice. D, F, and H were composed directly as full-board silhouettes. E and G were selected from seeded self-avoiding path-pack candidates (`0x9d2026`) using the actual game's path, collision, solver, and exact-state rules, then frozen as explicit routes. There is no runtime procedural generation.

The candidate screeners favored adjacent paths, multiple interleaved pairs, mixed path lengths, varied directions, low initial move counts, and dependency depth. The exact selected paths—not the search seed—are the canonical content. Each has a SHA-256 regression fingerprint in `tests/round9d-prototypes.test.ts`; a layout change therefore requires an intentional fingerprint update and renewed visual and solver review.

The rule engine rejects paths that are off the half-unit grid, use invalid steps, self-intersect, have inadequate self-clearance, collide with another stationary arrow, or cannot complete their own pull-and-exit movement. The exact reachable-state audit uses `simulateMove`, the gameplay movement/collision simulator. It has a hard 20-arrow limit and throws rather than reporting an incomplete proof. Candidate generation may help create content, but only frozen definitions that pass all these checks are selectable in QA.

## The five compositions

| Prototype | Design intent | Board | Arrows | Route lengths (short / medium / long) |
| --- | --- | ---: | ---: | ---: |
| D — Micro-Arrow Field | A compact half-grid field of short straight and hooked arrows with several headings and dense small removal chains. | 11×9 | 20 | 20 / 0 / 0 |
| E — Dense Interwoven Maze | A compact irregular angular mesh. Long and medium routes weave through one another, with short routes in interior pockets. | 16×13 | 11 | 1 / 7 / 3 |
| F — Tree Silhouette | An original arrow-built evergreen-like shape with stepped canopy edges, inner branches, trunk, and roots. No outline art is drawn on the board. | 14×15 | 12 | 10 / 0 / 2 |
| G — Large Mixed-Length Weave | A broader all-direction maze with winding long routes, medium braids, and short internal paths. | 20×15 | 13 | 2 / 7 / 4 |
| H — Framed Composition | Irregular arrow corridors surround a large deliberate central window; density is measured only inside the frame footprint. | 16×13 | 8 | 0 / 7 / 1 |

Length bands follow `analyzeLevel`: short ≤4 board units, medium >4 and ≤14, long >14. These are different design archetypes; the tree is intentionally clearer and less crowded than the abstract weaves, and the frame's open middle is purposeful.

## Composition measurements

Metrics below are diagnostic, not a replacement for looking at the rendered board. Neighbor spacing is Euclidean centerline distance between distinct paths. “Adjacent path” is the fraction of route length with another path within 0.75 cells. Footprint “large gap” is the fraction of 0.25-cell samples more than 1.5 cells from any path. Occupancy is path length divided by the authored footprint area, not inked-pixel percentage. The central window in H is outside its C-shaped footprint and does not count as a failed gap.

| Prototype | Adjacent path | Nearest distance min / median / p90 | Interleaved pairs | Blockers / depth / initial moves | Footprint path density / large-gap samples |
| --- | ---: | --- | ---: | --- | --- |
| D | 58.1% | 0.500 / 0.500 / 1.000 | 0 | 41 / 10 / 3 | 0.371 / 5.3% |
| E | 59.8% | 0.354 / 0.707 / 1.581 | 12 | 16 / 5 / 2 | 0.719 / 11.1% |
| F | 0.0% | 1.000 / 1.000 / 2.000 | 1 | 15 / 4 / 3 | 0.528 / 2.1% |
| G | 62.3% | 0.354 / 0.707 / 1.500 | 16 | 15 / 6 / 5 | 0.553 / 29.7% |
| H | 31.8% | 0.500 / 1.118 / 2.000 | 5 | 9 / 5 / 2 | 0.490 / 13.8% |

G has the highest path and interaction count, but its sampled full-board gap ratio is also the largest. Its paths are locally close and extend throughout a broad footprint; the preview should be used to judge whether its remaining pockets feel like a large weave or excess whitespace. This is one of the main playtest questions for the developer.

## Exact solvability results

All 20-or-fewer-arrow boards pass full geometry validation, produce a solver route, and pass the exhaustive reachable-state audit. The tests replay each returned solver move through the same `simulateMove` function used by gameplay, then enumerate every reachable remaining-arrow state. There is one empty terminal state, no deadlock witness, and no dependency cycle per prototype.

| Prototype | Reachable states | Legal transitions | Terminal states | Deadlocks | Cycles |
| --- | ---: | ---: | ---: | ---: | ---: |
| D | 396 | 1,020 | 1 | 0 | 0 |
| E | 81 | 206 | 1 | 0 | 0 |
| F | 344 | 1,276 | 1 | 0 | 0 |
| G | 195 | 565 | 1 | 0 | 0 |
| H | 18 | 27 | 1 | 0 | 0 |
| **Total** | **1,034** | **3,094** | **5** | **0** | **0** |

The audit is exact for these boards. The solver still has a maximum of 20 arrows; this release does not claim an efficient proof method for larger future puzzles. Prototype D is at that limit, and any larger prototype must wait for a separately justified solver strategy.

## Adaptive fit and zoom

`src/app/viewport.ts` computes bounds from every arrow centerline, complete arrowhead triangle, tail-marker circle, and sufficient stroke padding. It creates a viewBox with the real SVG viewport's aspect ratio and 12% composition margin, centered on those occupied bounds rather than the logical board rectangle. The logical board/grid can therefore be larger or irregular without making a small puzzle float tiny inside a fixed square.

The same SVG coordinate transform applies to the grid and arrows. Browser pointer locations are converted through the SVG screen transform before nearest-path selection, so the fit and pinch zoom do not change collision geometry or the deterministic touch radius. Reset-view returns to the fitted frame. Resizing/orientation changes recompute the base frame while retaining an existing zoom level where possible; pan clamping keeps part of the occupied puzzle reachable.

Tests exercise all five composition bounds at 320×568, 390×844, and 844×390, verify that the artwork stays inside the initial frame, and cover zoom, pan, and restore-fit. The individual previews use a 390×844 phone-proportion canvas. The board still respects the existing 20-arrow solver cap and app-area constraints; no physical iPhone test was performed.

## QA selection and previews

The QA-only Prototype Review menu offers A–H. Each uses normal gameplay movement, collision, hearts, restart, zoom, and touch selection. Review runs do not write Adventure progress. Prototypes D–H remain outside the active catalog and do not appear in production unless the build-time QA flag enables the dynamic QA module.

Previews are generated directly from the frozen JSON paths and use the game’s 0.12-cell monochrome stroke, arrowhead, tail dot, and faint half-grid:

- `docs/previews/round-9d/contact-sheet.svg`
- `docs/previews/round-9d/prototype-d.svg` through `prototype-h.svg`
- `docs/previews/round-9d/fit-comparison.svg` compares the former fixed logical-board fit with occupied-content fit for D and G.

The previews are static design references; they do not simulate arrow movement or prove physical-device touch behavior. Play all five from an iPhone in the QA environment before considering any layout for Adventure Mode.
