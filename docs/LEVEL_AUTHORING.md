# Adventure Level Authoring

## Active catalog

The active catalog is `src/game/adventure-catalog.json`, version `first-flight-r4-large-grid`. It preserves the five stable Round 11A IDs `first-flight-001` through `first-flight-005` and appends `first-flight-006`. Level 6 is a frozen 10×10 true-grid puzzle with 20 arrows and content version 1. Levels 1, 2, 4, and 5 remain content version 2; Level 3 remains version 3 after the c05 correction. Array positions are not identities. Adventure Mode loads checked-in definitions; candidate generation is offline only. The unchanged Round 10 definitions are preserved at `src/game/archive/adventure-catalog-first-flight-r2.json`.

The old six-level release is preserved in `src/game/archive/catalog-round8.ts`. The ten provisional Round 9 catalog definitions are preserved structurally in `src/game/archive/adventure-catalog-first-flight-r1.json`; their canonical JSON fingerprint matches the pre-reset catalog. Round 9C–9H prototypes remain separate under `src/game/prototypes/`; Round 9H and its regression tests are unchanged.

Round 11A is the approved production foundation. Round 13 experiments use a separate development branch and are promoted only after full validation. The scheduled QA synchronizer is disabled and its workflow source is archived; the separate QA Pages deployment is paused. Do not treat historical QA deployment records as a release gate.

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
5. Add or revise the frozen entry using the deterministic authoring helper for the current round. Round 11's `scripts/authoring/freeze-round11-catalog.mjs` creates a seeded linear forest across the visible lattice as an offline composition aid. The serializer writes explicit paths to runtime JSON; the game never generates this content. The checked-in JSON and fingerprints are the shipped content.
6. Render full-board and 390×844 previews. Inspect the actual grid, arrowheads, tails, occupied bounds, phone fit, readability, and silhouette. Metrics do not certify visual quality.
7. Run the full geometry validator. Reject self-intersections, doubled segments, self-collisions, stationary overlap, inadequate clearance, invalid exits, off-grid vertices, and invalid directions.
8. Run `solveLevel` and the exact `auditReachableStates` on every published candidate. Verify a full solution through `simulateMove` using the same level grid specification. Every reachable nonterminal state must have a route to completion. Never turn an incomplete or capped audit into a pass.
9. Record route lengths, total route units, occupied bounds, sampled gap ratio, minimum/median spacing, interleaved pairs, blocker links, initial legal moves, dependency depth, and state/transition counts. Use these to find weaknesses; then make a human visual and gameplay review.
10. Freeze the final JSON and update its SHA-256 regression. Any published geometry change requires a deliberate review and content-version increase. Appending new levels must not reset existing completion credit. Keep completed-level credit policy explicit if a published route changes; an in-progress board with incompatible geometry restarts through content-version migration.

## Validation tools and current results

`validateCuratedLevels` checks unique IDs and display numbers, contiguous progression, chapter references, metadata, true-grid specification, footprint geometry, path occupancy, collision clearance, interlocking diagnostics, solver success, and all-state solvability. `validateLevel` and `validateArrow` check actual movement geometry. `simulateMove`, solver, exact audit, and blocker graph share the same collision rules.

The exhaustive reachable-state audit supports at most 20 arrows. It visits every remaining-arrow subset, reports state and transition counts, and throws above its cap; a capped audit is never reported as exact. Level 6 has 20 arrows and is exhaustively audited.

For current static, removal-only boards, `auditBlockerGraph` offers a separate complete certificate for larger puzzles. An edge A→B means the gameplay simulator says A cannot exit while B alone remains stationary. Since collisions against multiple stationary arrows are the union of pairwise collisions, and each successful move removes an obstacle, the full remaining-state legality is exactly the induced blocker graph. If the graph is acyclic, every nonempty induced graph has a sink, so every legal removal choice leaves a completable DAG. If it has a cycle, repeatedly removing legal sinks yields a reachable residual deadlock. This is a proof, not subset enumeration or randomized sampling. It applies only while obstacles remain static and moves remove one arrow; do not apply it to future switches, gates, portals, moving hazards, or state-changing mechanics without a new proof. See [Round 13 Large-Grid Expansion](ROUND_13_LARGE_GRID_EXPANSION.md) for cross-checks and measurements.

The authoring suite reports close-neighbor, spacing, interleaving, dependency, route, and gap metrics. `scripts/authoring/round13-candidate-lab.mjs` can draft deterministic full-grid orthogonal candidates, and `scripts/authoring/benchmark-round13.mjs` measures graph, exact-audit, and move-simulation costs. These are offline aids, not a runtime generator or an automatic aesthetic approval. Each candidate must be rendered and visually reviewed. A true grid often imposes one-cell nearest path spacing; do not add hidden sub-grid lanes to raise density. The visible 0.12-unit body is independent from the fixed collision envelope. Touch target tolerance and rendering scale do not alter path or collision geometry.

### Larger-board release standard

New levels remain frozen JSON definitions with stable IDs, explicit content versions, and deterministic fingerprints. Prefer 10×10 to 12×12 only when the complete composition is well occupied, legible at phone fit, and playable with zoom. Avoid scattering short paths into a large rectangle or maximizing length for its own sake. Report route distribution, board intersection usage, neighboring-path coverage, spacing, interleaved pairs, blockers, dependency depth, and initial legal moves.

For up to 20 arrows, use the exhaustive subset audit. Above 20, use the static blocker certificate only after geometry validation and simulator-vs-graph checks; report the method explicitly rather than labeling it an exact state audit. Benchmark cold pairwise graph construction because each directed arrow pair invokes swept movement simulation. Keep expensive authoring proofs out of gameplay startup. Add full geometry, content fingerprint, progression, save migration, and a replayed solution regression for every new catalog entry. Test fitted camera bounds, hit testing, zoom/pan, and blocked/successful animation at 320×568, 390×844, 430×932, and desktop sizes. Physical iPhone review remains necessary for new dense content.

## Future silhouette footprint support

Silhouette authoring is future work. A lightweight future representation can retain the regular logical grid and attach one or more authored polygon masks or cell masks to indicate the intended visual footprint. The board grid may be clipped to that mask; arrow coordinates and movement remain in the same regular world frame. Paths must form the recognizable image themselves. Do not add uploads, automatic image tracing, irregular boundary rules, or silhouette generation without a separate design/validation task.

## Progress reset and save compatibility

Round 11 uses game save schema v4 and catalog version `first-flight-r3-compact-weave`. The save includes the current level content version. A v3 save from Round 10 preserves known completion IDs and the selected stable level ID. If that level is unfinished, its remaining arrows, red marks, and hearts are reset because the route geometry changed; a completed level retains completion credit. The v3 source is removed only after the v4 write succeeds. Appearance/audio preferences are untouched. QA storage keys remain in code for possible reintroduction but the QA environment is currently paused. Future content edits should increment content versions and test the same compatibility rules.
