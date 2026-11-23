# Arrow Adventure Roadmap

## Round 10 — five-level foundation

The current development branch replaces the provisional Adventure catalog with five individually frozen First Flight puzzles using true visible-grid geometry. The levels progress from a small teaching tangle to an 8×8 challenge. The catalog is versioned `first-flight-r2-true-grid`; game-save schema v3 discards prior Adventure completion data while preserving appearance and audio preferences. The prior six-level release, ten Round 9 catalog candidates, and Round 9H reference remain preserved outside active play.

All five boards pass path validation, stationary/swept collision checks, solver/runtime replay, and complete reachable-state audits. QA is the next review environment. Production remains unchanged until the developer plays the five levels on iPhone and approves promotion. See [Round 10 Foundation](ROUND_10_FOUNDATION.md) for level metrics, fingerprints, tests, and preview images.

## Release gates

1. Run the full test suite, typecheck, production-base build, and QA-base build.
2. Verify the five exact visible grids and exhaustive state audits; incomplete search is not a pass.
3. Review all starting boards and portrait renders for composition, readability, and consistent camera fit.
4. Deploy the validated candidate only to the independent QA Pages repository and confirm the source SHA and assets.
5. Have the developer test all five levels on iPhone, including touch selection, blocked-move hearts/reversal, zoom/pan, restart, Continue, and save reset.
6. Change production `main` only after explicit approval of the QA candidate.

## Future direction

- Continue authoring a small number of curated Adventure levels at a time. Keep all geometry on the declared visible lattice and freeze approved layouts with stable IDs, content versions, and fingerprints.
- Develop lightweight footprint masks so a future authored silhouette can clip grid rendering without changing the regular logical coordinates. Do not implement image upload or automatic silhouette generation until separately designed.
- Free Play remains a separate future mode. Generated puzzles must be deterministic and solver-verified, and optional mechanics must be selectable without being required for a solution.
- Black holes, switches, gates, portals, additional mechanics, and larger level collections are not part of Round 10. Specify movement/collision/solver semantics before implementing any of them.
- Preserve the approved Round 9H prototype as the current true-grid and physical-gameplay reference; do not copy its paths into future levels without deliberate redesign and review.
