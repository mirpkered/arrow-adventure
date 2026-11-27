# Arrow Adventure Roadmap

## Current foundation — Round 13, Milestone C

The production-only release workflow is active. QA Pages and the temporary QA-to-production synchronizer are paused; validated development branches move to `main`, where Actions independently validates and deploys the production build. Recovery and restoration instructions are in [QA environment and release procedures](QA_ENVIRONMENT.md).

First Flight keeps the five physically approved Round 11A levels and adds Level 6 (10×10, 20 arrows) and Level 7 (12×12, 30 arrows). Level 6 passes exhaustive reachable-state enumeration. Level 7 passes the complete static blocker-DAG proof for the current removal-only rules. Catalog additions preserve existing save credit and in-progress boards; only an explicit per-level content-version change invalidates that board.

## Round 13 — larger boards and proof scalability

Level 7 is now the second large-board release: a dense 12×12 board with 30 arrows. Its deterministic composition occupies all 169 grid intersections, has 24 interleaved pairs, 66 blocker links and dependency depth 7. The proof/regression suite and production release gate passed. Physical iPhone review remains outstanding.

The exact reachable-state enumerator remains capped at 20 arrows and reports actual subset and transition totals. Above that cap, a static blocker DAG can establish all-state completion without enumerating subsets because a move is legal exactly when no remaining arrow individually blocks it, and successful moves only remove static obstacles. The graph certificate is complete only for these rules. Future moving obstacles, switches, gates, portals, or other state changes need a separate proof or exact method.

A 14×14 board is the stretch experiment after Level 7 is stable. Do not enlarge boards just to hit a target arrow count; visual cohesion, geometry, and proof are release conditions.

## Release gates

For each production promotion:

1. Keep unfinished work on a development branch.
2. Run tests, typecheck, production build, build-content exclusion checks, geometry validation, and the appropriate exact or graph proof.
3. Inspect full-board and renderer-generated 390×844 previews; also check 320×568, 430×932, and desktop fit. Distinguish static previews from browser and physical-device tests.
4. Create a rollback checkpoint at the current production `main` revision.
5. Fast-forward or safely merge; never force-push.
6. Confirm the production Pages workflow and live `deployment.json`, page, and assets report the intended source revision.

Production is the current playtest environment, not permission to bypass validation. The developer physically approved the Round 11A five-level foundation and Round 9H movement/grid behavior. New levels still require physical iPhone review after the validated production deployment.

## Historical and deferred direction

Round 10 established the true-grid foundation; Round 11 refined compactness and corrected Level 3 c05. Earlier six-level, provisional ten-level, and prototype catalogs remain preserved in history and archives. Round 12's heart is isolated from Adventure Mode. Generic silhouette authoring, image uploads, Free Play, black holes, switches, gates, portals, monetization, and advertising remain deferred.
