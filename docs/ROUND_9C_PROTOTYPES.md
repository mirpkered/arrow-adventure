# Round 9C composition-first prototypes

## Status and separation

Round 9C adds three review experiments. They live in `src/game/prototypes/round9c-prototypes.json`; they are not imported by the Adventure Mode catalog and do not replace its ten candidate levels. A QA-only Prototype Review entry point dynamically loads these exact definitions for interactive testing. The prototypes have stable experiment IDs and frozen puzzle fingerprints in `tests/round9c-prototypes.test.ts`.

Starting branch commit: `6603a970fedfc5c580f78166073ad47ab08c1bbb`.
Recoverable checkpoint: `checkpoint/round-9c-before-composition` at the starting commit.

The three player-supplied reference screenshots and the archived Round 8 Level 6 preview were reviewed as visual references. The new paths are original compositions; none of the reference paths were traced or copied.

## Composition-first authoring workflow

These experiments were designed as complete board compositions before assigning arrow IDs:

1. Sketch the occupied silhouette, corridors, short-arrow pockets, and likely exit headings on the displayed half-unit grid.
2. Draw the long shared-space routes through the composition. For the advanced weave, author one asymmetric expanding spiral first, then partition its straight corridors into frozen winding arrows. This makes the overall board read as one maze and naturally creates a removal chain.
3. Add short routes only where they occupy an intentional gap or create a useful choice. Do not add filler arrows just to increase count.
4. Check the exact frozen paths for grid alignment, self-clearance, stationary collisions, arrowhead clearance, and escape geometry with the same engine used by gameplay.
5. Verify solver/runtime agreement, then exhaustively audit every reachable removal state. An incomplete or capped audit is not recorded as a pass.
6. Render the exact path definitions with the prototype stroke, arrowhead, tail marker, and board grid. Review composition at contact-sheet and phone-preview sizes; reject a candidate based on its visible shape even if its metrics are favorable.

`scripts/authoring/render-round9c.mjs` creates faithful SVG renderings from the frozen definitions. `scripts/authoring/render-round9c-previews.ps1` creates PNG review copies. The generated images do not use the production application renderer, but they share its board coordinates, body width, arrowhead dimensions, and tail marker geometry.

## Prototype designs

### A — Compact Abstract Weave

Six arrows on a 10×9 board. One long, twelve-turn route folds through the middle; a shorter upper return path runs close to it and points into its exit corridor. Four short arrows use the lower and side pockets to create a small branching removal puzzle.

The design has two initially removable arrows, five directed blocking relationships, and three dependency layers. It is the compact baseline rather than a catalog level.

### B — Heart in the Weave

Seven arrows on a 12×11 board. Four contour paths form two upper lobes, a central cleft, sloped shoulders, and a tapered bottom point. Three short internal paths add a removal puzzle without a rendered outline or background illustration.

The empty space outside the heart is intentional. Its footprint gap is zero, meaning every sampled point inside the authored heart silhouette is within 1.5 cells of an arrow path. The full rectangular board gap is therefore not used as a heart-quality score.

### C — Advanced Abstract Weave

Fifteen arrows on a 16×13 board. Twelve winding arrows partition an asymmetric expanding spiral from the inner turn to its open outer exit. Three short parallel arrows occupy close half-cell corridors. The resulting board uses mixed exit directions and gives three legal starting choices while retaining a deep dependency chain.

This is the advanced visual proof of concept; it is not a copy of archived Level 6. The spiral is deliberately asymmetric, and the short paths are placed in authored gaps instead of being independently generated and packed afterward.

## Composition measurements

Spacing values are centerline distances between different arrows. The fixed gameplay collision envelope remains 0.18 cells; the narrowest supported neighboring route in these prototypes is at least 0.3536 cells. All measured nearest-path minima are therefore above the gameplay collision width. Metrics guide review and do not replace visual approval.

| Prototype | Arrows | Route lengths (short / medium / long) | Adjacent-grid path ratio | Parallel corridor length | Neighbor spacing (min / p10 / median / p90) | Board large-gap ratio | Footprint large-gap ratio | Dependencies / depth | Initial legal moves | Interleaved pairs |
| --- | ---: | --- | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: |
| A — Compact Weave | 6 | 4 / 1 / 1 | 0.435 | 6.5 | 0.50 / 0.50 / 1.00 / 1.58 | 0.046 | 0.014 | 5 / 3 | 2 | 1 |
| B — Heart | 7 | 4 / 3 / 0 | 0.426 | 0.0 | 0.354 / 0.354 / 1.00 / 1.80 | 0.394* | 0.000 | 6 / 4 | 4 | 0 |
| C — Advanced Weave | 15 | 5 / 7 / 3 | 0.191 | 9.0 | 0.50 / 0.50 / 1.00 / 1.00 | 0.084 | 0.081 | 26 / 12 | 3 | 21 |

Route-length bands are short (≤4 cells), medium (>4 to 14), and long (>14). The adjacent-grid ratio measures path length whose nearest distinct path is within 0.75 cells. Interleaved pairs require multiple close-contact zones spread along both routes. The heart has no pair meeting that conservative multi-zone definition; its contour remains intentional, and the level is supported by zero footprint gaps and six blocking relationships.

`*` The heart's rectangular board large-gap value includes the deliberately empty area outside its silhouette.

## Geometry and state-space validation

All three definitions pass `validateLevel`, including unit-length grid steps, exact 45-degree diagonal steps where used, self-intersection and body/head clearance checks, self-traversal, exit geometry, and stationary arrow collision checks. `simulateMove` is used to replay each solver move; the test fails if solver and gameplay legality disagree.

| Prototype | Reachable states audited | Legal transitions | Terminal states | Deadlocks | Dependency cycles |
| --- | ---: | ---: | ---: | ---: | ---: |
| A — Compact Weave | 22 | 43 | 1 | 0 | 0 |
| B — Heart | 32 | 68 | 1 | 0 | 0 |
| C — Advanced Weave | 78 | 175 | 1 | 0 | 0 |

The audits are exact and exhaustive for every reachable successful-removal state. They use the same movement simulator as the game. Total coverage is 132 reachable states and 286 legal transitions. Failed blocked taps do not change board state, so they are covered separately by the existing heart/input tests rather than represented as state transitions here.

## Preview files and visual-review limits

The contact sheet and all individual previews are generated from the committed JSON paths:

- `docs/previews/round-9c/contact-sheet.png` and `.svg`
- `docs/previews/round-9c/prototype-a.png` and `.svg`
- `docs/previews/round-9c/prototype-b.png` and `.svg`
- `docs/previews/round-9c/prototype-c.png` and `.svg`
- `docs/previews/round-9c/heart-comparison.png` and `.svg`

The heart comparison uses a pale reference outline only in its left comparison panel. The playable heart panel contains arrow paths only. The individual PNGs are 780×1000 review images with the full board visible. The contact sheet includes each prototype name, board size, and arrow count.

This round includes static phone-proportion visual review of the generated previews. It does not include browser automation, a live touch test, or physical iPhone testing. The user should review the preview images and playtest the candidates before promoting or expanding the catalog.

## Promotion boundary

The prototype file is deliberately outside the active catalog. QA review uses the normal movement, collision, hearts, restart, and touch-selection code, but review runs are not saved as Adventure Mode progress. From an iPhone, start the QA game, hold the level label for two seconds, tap **Prototype Review**, then select A, B, or C. Use the HUD restart control to replay; the pause menu offers another prototype or a return to the previous QA board.

This change does not alter the ten-level catalog or production. The QA repository's manual candidate workflow remains the only deployment route for this feature; do not merge or promote any experiment until the composition is approved and a separate catalog change is prepared.
