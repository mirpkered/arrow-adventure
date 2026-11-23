# Adventure Level Authoring

## Active catalog

Round 10 establishes the active development catalog at `src/game/adventure-catalog.json`, version `first-flight-r2-true-grid`. It contains five frozen First Flight entries with permanent IDs `first-flight-001` through `first-flight-005`, display numbers, content versions, chapter/difficulty metadata, titles, composition notes, authored footprint polygons, and puzzle definitions. Array positions are not identities. Adventure Mode loads the checked-in definitions; it never generates levels at runtime.

The old six-level release is preserved in `src/game/archive/catalog-round8.ts`. The ten provisional Round 9 catalog definitions are preserved structurally in `src/game/archive/adventure-catalog-first-flight-r1.json`; their canonical JSON fingerprint matches the pre-reset catalog. Round 9C–9H prototypes remain separate under `src/game/prototypes/`; Round 9H and its regression tests are unchanged.

Production `main` remains on the former release until the Round 10 catalog has been played and approved on iPhone. Deploy a validated candidate to the isolated QA repository only.

## True visible-grid specification

The visible grid is authoritative for new Adventure content. A `W×H` board means exactly `W` square cells across and `H` down, with `W+1` vertical and `H+1` horizontal intersections. Use an explicit per-level grid specification:

```json
{"spacing":1,"origin":{"x":0,"y":0},"pathOffset":0,"includeOuterBoundary":true}
```

Vertices must be integer coordinates in `[0,W]×[0,H]`. Do not author half-cell positions. Each segment is a unit horizontal, vertical, or exact 45-degree diagonal step. Diagonal movement remains supported by the shared engine, but only use it when it serves the composition; ordinary Round 10 paths are orthogonal. The grid renderer uses the same transform as arrows, heads, tails, camera fit, pointer hit testing, movement, and collision checks.

Historical levels and experiments without an explicit `grid` continue using their legacy half-unit interpretation. Do not remove their grid specification or reinterpret their coordinates while authoring new content.

## Repeatable curation workflow

1. Choose a stable ID, display number, chapter, content version, difficulty, title, composition kind, design note, and intended footprint. Keep IDs stable if the level moves in display order.
2. State the visible `W×H` cell count and attach the explicit grid specification above.
3. Plan the entire composition before splitting it into arrows. Establish the main shared corridors, center/edge use, negative space, and clear exit routes. Add short arrows only where they contribute to the composition or puzzle choices.
4. Assign ordered points from tail to head. Keep routes simple and readable; use a deliberate mixture of straight paths, hooks, nested turns, and longer winding routes. Do not add decorative arrows or force turns to inflate metrics.
5. Add the frozen entry to `scripts/authoring/freeze-round10-catalog.mjs` and run `node scripts/authoring/freeze-round10-catalog.mjs` to serialize the deterministic content into the runtime JSON. This helper is authoring-time only. The JSON and its fingerprints are the shipped content.
6. Render full-board and 390×844 previews. Inspect the actual grid, arrowheads, tails, occupied bounds, phone fit, readability, and silhouette. Metrics do not certify visual quality.
7. Run the full geometry validator. Reject self-intersections, doubled segments, self-collisions, stationary overlap, inadequate clearance, invalid exits, off-grid vertices, and invalid directions.
8. Run `solveLevel` and the exact `auditReachableStates` on every published candidate. Verify a full solution through `simulateMove` using the same level grid specification. Every reachable nonterminal state must have a route to completion. Never turn an incomplete or capped audit into a pass.
9. Record route lengths, total route units, occupied bounds, sampled gap ratio, minimum/median spacing, interleaved pairs, blocker links, initial legal moves, dependency depth, and state/transition counts. Use these to find weaknesses; then make a human visual and gameplay review.
10. Freeze the final JSON and update its SHA-256 regression. Any published geometry change requires a deliberate review and content-version increase. Keep completed-level credit policy explicit if a content change occurs after public release; Round 10 itself resets retired progress rather than mapping it to new levels.

## Validation tools and current results

`validateCuratedLevels` checks unique IDs and display numbers, contiguous progression, chapter references, metadata, true-grid specification, footprint geometry, path occupancy, collision clearance, interlocking diagnostics, solver success, and all-state solvability. `validateLevel` and `validateArrow` check the actual movement geometry. `simulateMove`, the solver, and reachable-state audit share the same collision rules.

The exact state audit currently supports no more than 20 arrows per puzzle. It memoizes remaining-arrow subsets and throws if its state budget is exceeded. Round 10's largest puzzle has 15 arrows. Its five puzzles were fully enumerated across 507 states and 1,430 legal transitions, with no deadlocks or dependency cycles. See [Round 10 Foundation](ROUND_10_FOUNDATION.md) for level metrics, exact route lengths, fingerprints, and links to the previews.

The authoring suite reports close-neighbor, spacing, interleaving, dependency, route, and gap metrics. A true grid often imposes one-cell nearest path spacing; do not add hidden sub-grid lanes to raise density. The visible 0.12-unit body is independent from the fixed collision envelope. Touch target tolerance and rendering scale do not alter the path or collision geometry.

## Future silhouette footprint support

Silhouette authoring is future work. A lightweight future representation can retain the regular logical grid and attach one or more authored polygon masks or cell masks to indicate the intended visual footprint. The board grid may be clipped to that mask; arrow coordinates and movement remain in the same regular world frame. Paths must form the recognizable image themselves. Do not add uploads, automatic image tracing, irregular boundary rules, or silhouette generation without a separate design/validation task.

## Progress reset and save compatibility

Round 10 uses game save schema v3 and catalog version `first-flight-r2-true-grid`. Startup removes prior environment-specific game keys v1/v2 and legacy game progress keys. It preserves independent appearance and audio settings. Old completion data is not mapped to new IDs. Current saves store stable level IDs and stable board state only; animation frames are never saved. Production and QA use different local-storage namespaces. Future save changes should increment the schema version, define which IDs/content versions remain valid, reject unknown states safely, and test migration idempotence without deleting unrelated preferences.
