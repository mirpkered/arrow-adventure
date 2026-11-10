# Round 9 Level Authoring

## Release status

The Round 9 branch contains a ten-entry catalog candidate under `first-flight-r1`. Its paths are frozen as JSON and validated by the runtime movement simulator, exact reachable-state audit, and deterministic fingerprints. The current generated candidates have not all met the required visual composition review. Do not promote this branch to QA or production until all ten are deliberately curated and visually approved.

The six Round 8 definitions remain in `src/game/archive/catalog-round8.ts`. That archive is never imported by the active catalog. The archived Level 6 is a visual reference only, and archived content is not restored to player progression.

## Catalog definition

Each entry in `src/game/adventure-catalog.json` has a permanent ID (`first-flight-NNN`), display number, catalog and content versions, chapter ID, title, difficulty, composition kind, design note, intended footprint, and exact puzzle definition. Display order is metadata; array indices are not identities. Published changes require a deliberate content-version increase and an updated frozen fingerprint test.

The target catalog is exactly seven abstract weaves and three silhouettes. For a silhouette, the arrow paths themselves must read as the intended image; a footprint polygon is only a QA measurement mask and is not rendered in play. Candidate generation is an offline aid. Adventure Mode loads only the frozen JSON definitions.

## Repeatable authoring process

1. Sketch the complete composition first and define its board footprint.
2. Route the long nested paths through the shared visual region, then add shorter paths that make the overall weave coherent.
3. Make silhouettes from arrow paths themselves. Review the board without any footprint overlay.
4. Preserve the approved half-unit display grid, cardinal and 45-degree moves, fixed collision envelope, arrowhead geometry, touch tolerance, and self-traversal checks.
5. Run `validateCuratedLevels`, the exact reachable-state audit, and the geometry tests against the frozen JSON. Do not accept solver success alone.
6. Render all ten starting boards, inspect full-board thumbnails and phone-sized views, and reject sparse, repetitive, or ambiguous compositions even when the metrics pass.
7. Record the selected candidate source/seed in authoring notes, freeze the resulting puzzle JSON, and add its SHA-256 fingerprint. Never regenerate active Adventure Mode content at runtime.
8. Play every board on mobile after the browser review; generated screenshots do not substitute for device playtesting.

## Quality measurements

`src/game/density.ts` measures path length inside the authored footprint and samples its area at 0.25-unit intervals. A sample is a large gap when it is farther than 1.5 units from every arrow centerline. `measureNeighborSpacing` reports minimum, 10th, median, and 90th-percentile segment spacing between different arrows. `analyzeLevel` reports multi-zone interleaving, close segment contacts, blocker links, safe openings, unlock counts, dependency depth, lengths, and turns.

These values screen candidates; they do not prove a good composition. In particular, a compact footprint or many close contacts can still hide visual separation. The Round 9 draft uses a 0.18-unit canonical body envelope and 0.18-unit maximum arrowhead envelope, independent of the visible 0.12-unit body. The narrowest authored distinct-arrow spacing in the current candidates is 0.3536 units; the game retains a generous 0.75-unit touch-pick radius and deterministically selects the nearest path. Confirm that precision at phone scale before promotion.

Round 9B curation can also use `measureComposition`. It reports the share of route length whose nearest distinct path is within 0.75 units (including half-unit adjacent grid lines and close diagonals), the total length of parallel neighboring corridors, short/medium/long route counts (at most 4, over 4 through 14, and over 14 units), exit-heading counts, and the share of routes within the 1.5-unit touch-competition range. Compare these measurements with neighbor-spacing percentiles and the footprint heatmap; do not optimize any one score in isolation. The current authoring helper has a regression test using parallel half-unit lines. No new candidate is considered approved by the metric alone.

## Exact validation

`validateArrow` checks continuity, unit cardinal/diagonal steps, self-intersection, body and head clearance, and the complete self-traversal and exit. `validateLevel` checks stationary collisions between different arrows. `simulateMove` checks the entire moving arrow against stationary arrows and is shared by gameplay, solver, and catalog validation. `auditReachableStates` exhaustively visits every reachable remaining-arrow subset up to 20 arrows, reports deadlock witnesses and dependency cycles, and throws if its explicit state cap is exceeded.

The current candidate validator checks stable metadata, footprint validity, path occupancy, sampled whitespace, spacing, interleaving, dependencies, solver completion, and exact state audit. A failed or incomplete audit is never a pass. Remaining authoring concerns are visual coherence and the readability of the three claimed silhouettes; these require manual selection and review before release.

## Save compatibility

Round 9 uses game save version 2 and catalog version `first-flight-r1`. A save is accepted only when its catalog version and stable level/arrow IDs match. Startup removes the retired environment-specific game key and old legacy progress key, but leaves settings in their independent storage key untouched. New saves store only stable board states, never animation frames. Changing the catalog version again requires a documented migration or a deliberate progress reset; do not infer progress by array index.
