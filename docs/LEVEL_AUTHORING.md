# Curated Level Authoring

## Current catalog contract

The current release contains exactly six boards. Do not add levels until the current gameplay has been reviewed. The catalog in `src/game/catalog.ts` stores exact definitions under stable IDs `shared-board-001` through `shared-board-006`; the display number is separate metadata and remains contiguous from 1.

Each entry contains a title, difficulty, authoring note, and puzzle dimensions and arrows. Arrow paths are ordered tail-to-head. The canonical grid spacing is 0.5 board units, with origin `(0,0)` in the board SVG. Authored coordinates may be integer or half-integer, but all must lie on this lattice after the shared `toBoardPoint` transform. The existing `+0.5` path-to-board offset preserves every published path while placing its displayed vertices on exact grid intersections; do not round or translate old points. Each path step is exactly one board unit: cardinal segments have one zero axis displacement, and diagonals have equal 1-unit horizontal and vertical displacements. No other angles or lengths are allowed. Paths may not repeat a point, cross themselves, leave the board, or overlap another stationary arrow's collision envelope.

## Repeatable authoring process

1. **Sketch the whole silhouette.** Decide if the board is compact, rectangular, nested or shaped. Pack paths into the same area instead of assigning independent lanes.
2. **Route the long arrows first.** Use hooks, nested U-turns, corridors and alternating headings. Let long routes wrap around shorter interior paths.
3. **Fill the remaining corridors.** Add short and medium arrows that block meaningful exits or make a safe removal open another option. Preserve enough spacing for touch selection and clear arrowheads.
4. **Keep positions deliberate.** Use intersections on the canonical 0.5-unit lattice and close parallel runs only when the full fixed collision envelope remains legal. Do not invent an offset grid or alter visible stroke presets to make a board pass collision validation.
5. **Freeze the chosen definition.** Store the final paths directly in the catalog. Procedural candidate generation is an authoring aid only; it never runs during Adventure Mode or QA play.
6. **Validate and review.** Run the full solver/catalog tests, inspect the geometry preview, check ownership and hit-target diagnostics, and manually play every board at phone scale.

## Metadata and progression

Use a new stable ID only for a genuinely new content identity. Keep IDs independent of array indexes. Display numbers are contiguous in this reset prototype and should not be silently renumbered. Difficulty is one of `intro`, `steady` or `challenging`. Write a design note describing the board's intended read or dependency.

There are no chapters or tutorials in the current release. If later approved, chapter metadata and tutorial references should be explicit catalog fields, not inferred from a level number. Add a new chapter only through a reviewed roadmap change. Do not implement future mechanics merely by adding tags; their movement/collision semantics require separate design and solver work.

## Geometry, collision and solver validation

`validateArrow` rejects off-grid coordinates, malformed segment lengths or angles, repeated/overlapping segments, nonadjacent self-contact, insufficient self-clearance, and arrowhead collisions with the moving arrow's unretracted body. It uses the same `moveArrowDistance` primitive as animation and checks the complete route plus exit sweep. `validateLevel` then checks separation between stationary arrows. Body clearance is at least 0.18 board units; the sweep conservatively uses 0.23 units for the 0.05-unit sample interval. Head/body clearance uses the conservative maximum arrowhead triangle and is expanded by the same sample interval. The visible head remains fixed at its 0.15-unit reference size. Body presets (default 0.12; QA 0.12, 0.15, 0.18) do not change validation or collision geometry.

`simulateMove` follows the arrow's entire route, including its moving body, head and final exit. It samples at 0.05 board cells and applies the sampling interval conservatively to the collision test. Gameplay and the solver use this exact simulator. Never write a second approximate solver rule. The solver caches derived blocker graphs by serialized puzzle definition; changed content produces a new cache key.

Every published prototype entry must pass:

- Unique stable ID and display number, complete metadata and contiguous numbering.
- Valid board bounds, legal cardinal/diagonal steps, collision-free self-traversal, and no stationary overlaps.
- At least `max(2, ceil(arrow count × 0.35))` interleaved arrow pairs.
- At least five close segment contacts per arrow and a centerline occupancy ratio of 0.25 or greater. Shaped boards can justify a lower threshold only through explicit review and a corresponding test change.
- At least two dependency waves, a nonzero safe opening, and no more than 60% of arrows initially removable (rounded up). Some small tangles can have several safe starts while retaining meaningful blocking relationships.
- Varied path lengths and turn counts, plus a solver-found complete removal order.
- Frozen SHA-256 fingerprints for all six current definitions.

The catalog validator also calls `auditReachableStates`. It computes blocker edges with the actual `simulateMove` engine, then exhaustively visits every reachable remaining-arrow subset and verifies that each nonterminal state has a legal exit and reaches the empty state. It reports deadlock arrow IDs, the removal sequence that reached a deadlock, and dependency cycles. The audit is exact up to 20 arrows and `2^20` states; larger boards fail explicitly instead of being treated as validated. Current boards top out at 16 arrows. See [Solvability Audit](SOLVABILITY_AUDIT.md) for the method and Level 4 report.

`analyzeLevel` reports close segment contacts (segment pairs within 1.5 cells), repeated interleaving (at least three close segments from each route), blocker links, initially removable arrows, unlock gains, dependency depth, route lengths, turn counts and centerline occupancy. These measurements reject weak layouts but do not replace visual inspection. A high contact count can still come from a visually confusing or poorly composed board.

## Collision and art separation

The gameplay grid is emitted inside the same SVG as arrows at 0.5-unit intervals, so it automatically follows the exact fitted, zoomed, and panned board transform. The fine grid is low-contrast; integer-coordinate lines are emphasized only by QA geometry diagnostics. Each path centerline and arrowhead renders in that same coordinate frame. Collision and solver rules always use the fixed 0.18-unit body envelope regardless of visible thickness. When paths are repositioned, run tests for body and arrowhead separation; grid-point alignment alone does not establish legality. Recheck nearest-path hit selection for adjacent arrows at normal scale and zoom.

## Protecting published QA content

Each current puzzle's SHA-256 fingerprint is asserted in `tests/game.test.ts`. Any path edit changes that fingerprint. Update it only with a deliberate content review and a commit that includes a new preview and solver/geometry results. QA candidate deployments are pinned to a full source SHA, so each layout is reproducible. Push selected production releases to `main` only after validation; feature candidates remain independently deployable to QA.

## Progress and persistence

The game stores a versioned save with current stable level ID, completed IDs, remaining arrow IDs, persistent red-arrow IDs, hearts and completion state. It saves only between actions; in-flight path animation is never serialized. Invalid saves are ignored without deleting their source. The old release keys are never imported. Settings are saved independently.

Production uses `arrow-adventure.production.*`; QA uses `arrow-adventure.qa.*`. Both Pages URLs share the `github.io` origin, so the environment namespace is required to prevent QA testing from changing production progress or preferences. Keep this namespace separation in future persistence changes.
