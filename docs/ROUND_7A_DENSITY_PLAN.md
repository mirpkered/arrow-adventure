# Round 7A — Puzzle Density Baseline (Historical)

This document preserves the measurements taken before the Round 8 Level 5 redesign. The final section records the resulting comparison; the original baseline table is retained for traceability.

This is a planning document only. The six catalog definitions, collision rules, solver, and touch-selection behavior were not changed for this phase.

## Current measured layout

The table uses the current `analyzeLevel` metrics plus a 0.25-cell sampling of each board. At every sample point, the distance to the nearest arrow centerline is measured. The final column is the share of sampled board area farther than 1.5 cells from every route. It captures large open regions better than bounding-box overlap alone. “Path occupancy” is total centerline length divided by board area; it is a route-density proxy, not a literal count of filled pixels.

| Level | Board | Arrows | Route length | Path occupancy | Interleaved pairs | Close contacts | P90 nearest path | Area >1.5 cells from path | Initial safe moves | Dependency depth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 — Small Tangle | 9×9 | 7 | 54 | 0.667 | 7 | 119 | 0.95 | 4.8% | 2 | 5 |
| 2 — Dense Mini-Maze | 12×11 | 12 | 94 | 0.712 | 10 | 222 | 0.88 | 1.0% | 4 | 7 |
| 3 — Nested Paths | 12×12 | 7 | 76 | 0.528 | 6 | 131 | 1.43 | 9.2% | 4 | 2 |
| 4 — Interwoven Board | 14×12 | 10 | 108 | 0.643 | 8 | 218 | 0.88 | 0.9% | 2 | 8 |
| 5 — Shaped Puzzle | 13×14 | 7 | 73 | 0.401 | 4 | 100 | 3.19 | 35.4% | 3 | 3 |
| 6 — Dense Challenge | 16×16 | 16 | 170.4 | 0.666 | 20 | 354 | 0.88 | 1.6% | 5 | 8 |

The most measurable whitespace issue is Level 5: its seven paths occupy a recognizable shape, but four are only one to four cells long and more than a third of the board samples are over 1.5 cells from any path. Level 3 is the next candidate for tighter interior packing. Levels 2 and 6 already have consistently close route coverage. Level 4 has strong path length and contact counts, although most nearest-segment pairs remain at least one cell apart; visual review should decide whether to move paths closer or preserve that spacing for clarity.

These numbers are reference measurements for the next design pass, not evidence that the puzzles are visually successful. Contact count uses segment pairs within 1.5 cells and can be high even where the board silhouette still has empty pockets.

## Geometry and interaction constraints

- Every path is authored tail-to-head. Coordinates may sit on the half-cell lattice, but each step remains a full cardinal or 45-degree diagonal unit. Scaling a finished path to squeeze it into a smaller board is invalid; tighter packing must come from deliberate rerouting and re-authoring.
- Current visible widths are 0.12, 0.15, and 0.18 cells. The canonical collision envelope remains fixed at 0.18 cells, with conservative sweep clearance for the 0.05-cell sampling step. Density must not depend on the selected stroke preset or change the solution.
- Each arrow must pass self-intersection, self-clearance, arrowhead, full-route, retraction, and exit checks before board-level overlap checks.
- Different arrows need at least the existing 0.18-cell stationary body clearance, plus the current head and swept-motion checks. Close parallel routes may be packed at half-cell spacing where the actual segment geometry remains legal; a grid-point-only test is insufficient.
- Touch selection uses `nearestArrowAt` over the actual centerlines with a 0.75-cell pick radius. Nearby pick regions therefore overlap by design. The closest route wins deterministically, with arrow ID as the tie-breaker. A dense redesign should test taps in the narrow channel between adjacent routes at phone scale and while zoomed.
- Exhaustive reachable-state validation currently has a hard limit of 20 arrows. Keep authored candidates within that limit unless a separately reviewed state-audit bound is implemented.

## Recommended redesign workflow

1. Start with Levels 5 and 3, which have the greatest measured open-area share. Keep Levels 2 and 6 as spacing/readability references and only edit them if visual review identifies a specific empty pocket.
2. Set each board silhouette and playable bounds first. Route a few long, winding paths through the shared center; use nested hooks and corridors that pass beside other paths, not separate lanes.
3. Fill the resulting interior pockets with medium paths that create intentional blockers. Avoid padding the arrow count with many short straight exits.
4. Generate deterministic candidate variants only as an authoring aid. Freeze selected paths directly in `catalog.ts`; do not make Adventure Mode layouts depend on random generation at runtime.
5. Reject a candidate if canonical geometry validation fails, any reachable legal-removal state deadlocks, collision and solver results disagree, or taps cannot be distinguished. Run both exact geometry checks and exhaustive state auditing for each candidate.
6. Compare before/after measurements using the same 0.25-cell board sampling. Suggested initial targets are P90 nearest-path distance at or below 1.0 cell and no more than 10% of sampled area farther than 1.5 cells from a route. Treat these as review gates, not a score to maximize: shaped boards may retain intentional negative space if playtesting supports it.
7. Play every accepted board with ownership and hit-target diagnostics at portrait phone scale, test adjacent-path taps and zoom, then freeze its fingerprint and document the intended dependency pattern.

Do not trade away the introductory read of Level 1, Level 3’s already-approved puzzle quality, or legal arrow motion just to satisfy a density threshold. If tight paths make touch selection ambiguous, improve composition or zoom guidance rather than widening the visible strokes.

## Round 8 result — Level 5

Level 5 was re-authored as a 12×14 canopy-and-hooked-trunk silhouette. It now has 8 arrows and 97 units of total path length (previously 7 arrows and 73 units on 13×14). Using the same 0.25-unit sample grid and 1.5-unit distance threshold, area farther from all paths changed from 35.4% to 18.75%, a 16.65 percentage-point reduction (about 47% relative). Path occupancy changed from 0.401 to 0.577. The puzzle has 6 interleaved arrow pairs, 141 near segment-pair contacts, dependency depth 3, and 4 initially safe moves. It has 38 exact reachable states, 83 legal transitions, and no deadlocks. Level 6's definition and fingerprint were unchanged.

These are composition measurements, not proof of quality; physical iPhone review remains necessary for legibility and tap separation.
