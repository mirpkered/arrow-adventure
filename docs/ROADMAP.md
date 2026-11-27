# Arrow Adventure Roadmap

## Current foundation — Round 11A

The approved First Flight catalog contains five stable IDs under `first-flight-r3-compact-weave`. It preserves the true visible-grid system, compactness refinements, and corrected Level 3 c05 direction. The physical iPhone playtest approved these levels and core movement. The old Round 10 catalog remains archived for history; Round 12's heart is an isolated experiment and is not Adventure Mode content.

## Round 13 — production-only workflow and larger boards

Round 13 pauses the separate QA Pages environment and removes the temporary scheduled QA-to-production synchronizer. Feature branches still isolate unfinished work; validated commits fast-forward to `main`, where production Actions independently tests, typechecks, audits, builds, deploys, and verifies the exact source revision.

The gameplay work expands First Flight with curated, frozen, dense true-grid boards. Initial targets are a 10×10 Level 6, a 12×12 Level 7 if scalable solvability proof is established, and a 14×14 stretch experiment only after those milestones pass. The existing five puzzles, identities, content versions, save data and migration behavior remain intact as levels are appended.

The current exact reachable-state audit limit is 20 arrows. Round 13 is evaluating a static blocker-graph certificate for larger boards. Any such certificate must be proved for removal-only static obstacles, compared against exact enumeration on small boards, and clearly distinguished from exhaustive state enumeration. Do not use graph certification for future moving mechanics without a new proof.

## Release gates

For every production promotion:

1. Keep the experiment on its development branch until geometry, solver/runtime agreement, solvability validation, progression and persistence tests pass.
2. Inspect full-board and 390×844 portraits at 320×568, 390×844, 430×932, and a desktop viewport.
3. Run the full suite, TypeScript checks, production build and `git diff --check`.
4. Create a rollback checkpoint at the currently deployed `main` revision.
5. Fast-forward or safely merge the validated branch into `main`; never force-push.
6. Confirm the Pages workflow succeeds and the live `deployment.json`, page and assets report the expected revision.

Production is the current playtest environment, not permission to bypass validation. Physical iPhone testing should be distinguished from automated viewport and touch simulation.

## Historical and deferred direction

Round 10 established the five-level true-grid foundation, and Round 11 refined its compactness. Earlier prototype sets, six-level release archives and provisional catalogs remain in version control. Generic image-to-puzzle generation, silhouette authoring, Free Play, black holes, switches, gates, portals, monetization and advertising remain deferred.
