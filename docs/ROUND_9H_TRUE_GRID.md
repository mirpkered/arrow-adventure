# Round 9H — True 7×7 Grid Prototype

Round 9H is one experimental composition, stored at `src/game/prototypes/round9h-square-true-7.json`. Its stable prototype ID is `prototype-square-true-7`, content version 1, and puzzle SHA-256 is `7d48e27bbb9a7d4212eefc5548549f9bd227eed0eb0d7111dac4c1341629ac8a`. It is registered as an additional QA-only Prototype Review choice and remains outside the Adventure catalog. It does not change the active ten-level catalog, save format, or production game.

## The visible grid is the coordinate authority

This prototype is exactly seven square cells by seven square cells. The 8 intersection coordinates on each axis are `0, 1, 2, 3, 4, 5, 6, 7`. The explicit grid specification is:

```json
{
  "spacing": 1,
  "origin": { "x": 0, "y": 0 },
  "pathOffset": 0,
  "includeOuterBoundary": true
}
```

Every route vertex is an integer point in that range. Each route segment is one horizontal or vertical visible-grid interval. There are no diagonal segments, half-step path positions, or fine-grid subdivisions. `boardGridMarkup` draws eight vertical and eight horizontal positions for this specification; the fine-grid path is empty.

The per-level grid specification keeps the old content interpretation intact. Levels and experiments without an explicit specification retain the legacy `spacing: 0.5`, `pathOffset: 0.5` mapping and their prior boundary rules. Rendering, heads, tails, fit bounds, pointer hit-testing, movement, collision, and state audits use the level's path offset/specification. The solution and blocker cache keys now include the grid specification so different coordinate frames cannot reuse one another's results.

## Frozen composition and validation

The complete corridor preview is the same frozen body geometry with arrowheads and tail markers hidden. The final routes assign a tail and head to each corridor and use no runtime generation. There are 15 distinct arrow IDs. The route lengths are four 5-cell paths, six 3-cell paths, and five 2-cell paths: 48 route units total. Exit headings are balanced across the four cardinal directions: north 4, east 3, south 4, west 4.

All 63 route vertices are unique; 63 of the 64 displayed intersections are used. The path bounds occupy the full board, from `(0,0)` through `(7,7)`. The 48 route units divided by the 49-cell board area give a route-to-area ratio of 0.980; this is a line-length measure, not a filled-area claim. The 1.01-cell adjacency threshold finds 100% of route length within one neighboring grid interval of another path. Nearest centerline spacing is 1 cell at minimum, p10, median, and p90. At a 0.125-cell sample step, no board sample lies more than 1.25 cells from a route. Those gap/adjacency values are descriptive; visual inspection remains necessary.

The shared geometry analysis reports 144 close segment contacts and 9 interleaved arrow pairs. A separate same-corner comparison finds 10 pairs with matching bend orientations within 1.6 cells; none are within 1.1 cells. On this vertex-disjoint orthogonal lattice, two paths cannot use the same turn vertex, so the coordinated bends are neighboring rather than coincident. Visual review should consider whether this degree of winding is enough before any promotion.

The actual movement simulator reports 21 directed blocking relationships, dependency depth 8, and five initially removable arrows (`h03`, `h05`, `h07`, `h08`, `h09`). The exact reachable-state audit visits 316 distinct states and 1,052 legal removal transitions, reaches the empty board once, and finds zero deadlocks and zero dependency cycles. The solver's full solution is replayed arrow by arrow through `simulateMove` with the explicit grid specification. The prototype validator also checks every path for integer grid alignment, orthogonal unit segments, self-clearance, exit geometry, stationary collisions, and valid head/body movement.

The displayed stroke remains 0.12 board units; collision and touch rules are unchanged. Minimum neighboring centerline distance is one full visible cell, so this layout does not use sub-grid closeness to imitate the previous 14×14 visible lattice.

## Previews

All previews are generated from the frozen JSON geometry by `scripts/render-round9h-previews.ps1`:

- [Visible-grid diagnostic — 8 intersections per axis](previews/round-9h/true-grid-diagnostic.png)
- [Full-size gameplay preview](previews/round-9h/true-grid-7x7.png)
- [390×844 portrait preview](previews/round-9h/true-grid-7x7-iphone.png)
- [Arrow-ID diagnostic](previews/round-9h/true-grid-7x7-ids.png)
- [Corridor-only composition](previews/round-9h/true-grid-7x7-corridors.png)
- [Matched board-space comparison with Round 9G](previews/round-9h/round9g-vs-round9h-visible-grid.png)

The comparison labels Round 9G as 14×14 visible subcells and Round 9H as 7×7 visible cells. The portrait image is a renderer-based preview, not a physical-device capture.

## Validation status and limits

Automated Round 9H tests verify the frozen fingerprint, exact rendered grid line positions, rejection of a half-step mutation, all route geometry, footprint and spacing measurements, exact state audit, simulator replay, touch-coordinate selection, and fit/zoom/pan behavior at representative phone and landscape viewports. Round 9F/9G tests preserve their original half-unit interpretation. The exhaustive audit cap remains 20 arrows; this prototype's 15 arrows are fully within that bound.

Round 9H is available only in the QA Prototype Review build; production builds do not load this module. The portrait image is a renderer-based viewport preview, not a browser capture. Physical iPhone testing remains outstanding.
