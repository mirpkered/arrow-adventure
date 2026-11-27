# Round 12 — Full-Area Heart Prototype

## Scope and separation

This is an isolated QA playtest prototype with the stable ID `prototype-round12-heart`, content version 1, and fingerprint `8bd2f9cabfe351654291158711aeb498a729b51f984fe917a04da0249e85e256`. It is appended to the QA Prototype Review choices as **Round 12 — Heart Prototype**. It is not part of `adventure-catalog.json`, does not change the five Adventure Mode levels, and prototype runs do not write Adventure Mode progress.

## Footprint and visible grid

The board is a true 10×11-cell grid: 11 intersection positions across and 12 down. All footprint corners and all arrow vertices use integer intersections; all 63 route units are horizontal or vertical. The heart outline has paired top lobes, a center notch, broad shoulders, and a single bottom point at `(5,11)`.

The logical coordinates and rectangular board bounds are unchanged. For this prototype only, an authored polygon is used to fill the heart and clip the visible grid through an SVG `clipPath` in board coordinates. Arrow art remains in the normal SVG coordinate system, so pointer mapping, zoom, pan, movement, and collision behavior continue to use the same grid. Fit-to-frame bounds include both the arrow artwork and the complete heart footprint, with 5.5% margins. The selection list retains the earlier prototypes and Round 9H.

## Composition and measured properties

The board contains 14 frozen arrows with route lengths (grid units) `8, 7, 6, 6, 5, 5, 4, 4, 4, 4, 3, 3, 2, 2`, for 63 units total. That is four short (2–3), eight medium (4–6), and two long (7–8) paths. The exits are distributed north 4, south 4, east 3, west 3.

The actual authored footprint samples 71.5 square units at a 0.25-unit measurement step. Route length divided by footprint area is 0.88 grid units per square unit; this is a route-density indicator, not a literal filled-pixel percentage. No sampled point inside the heart is farther than 1.5 cells from an arrow (0% of 1,144 samples exceed that gap threshold). Every arrow segment stays within the footprint. Minimum, median, and 90th-percentile nearest route spacing are all 1 grid unit. The board has 12 interleaved arrow pairs, 184 close segment contacts, 20 blocking dependencies, dependency depth 8, and five initially removable arrows. These metrics support visual review; the previews remain the design acceptance evidence.

## Validation

All 14 arrows pass the production geometry validator, including grid alignment, self-clearance, arrowhead clearance, swept traversal, inter-arrow collision, and exits. The exact reachable-state audit visits 112 states and 288 successful-removal transitions, reaches the empty board, and reports zero deadlocks and dependency cycles. A complete solution is replayed through the same simulator used by gameplay. Touch-pick midpoints are tested against every arrow at phone viewport dimensions, and fit, zoom, pan, and restore-fit are covered at 320×568, 390×844, and 430×932.

## Preview set

- [Full board](previews/round-12-heart/heart-full-board.png)
- [390×844 phone composition](previews/round-12-heart/heart-iphone-390x844.png)
- [Footprint and clipped-grid diagnostic](previews/round-12-heart/heart-footprint-grid-diagnostic.png)
- [Arrow-ID diagnostic](previews/round-12-heart/heart-arrow-ids.png)
- [Corridor-only structure](previews/round-12-heart/heart-corridor-structure.png)
- [Footprint coverage comparison](previews/round-12-heart/heart-area-coverage-comparison.png)

All preview files are rendered from the frozen JSON by `scripts/render-round12-heart-previews.ps1` using the approved arrow stroke, head, tail, grid, and light palette.

## Limitations and review

The clipped footprint changes only the rendered mask and camera-fit bounds. The engine still considers the full 10×11 rectangle the board for escape, so an arrow can pass across the ungridded exterior of the heart while completing its normal exit. No general silhouette editor, arbitrary-mask importer, or shape-derived path generator is included. The layout has not yet received physical iPhone review; QA deployment is for that review. Production remains unchanged.
