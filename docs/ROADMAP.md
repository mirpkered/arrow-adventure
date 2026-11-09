# Arrow Adventure Roadmap

## Round 9 development status

Round 9 replaces the active Adventure catalog on its development branch with ten deterministic, versioned candidate levels in `src/game/adventure-catalog.json`. The previous six-level definitions are retained only in `src/game/archive/catalog-round8.ts`. The candidate set passes the current geometry checks, solver, and exact reachable-state audit. Visual review found that several candidate layouts are too dispersed or do not read clearly as their intended silhouettes. They are not approved for QA or production deployment.

The source branch is `round-9/adventure-rebuild`. Production `main` and the independent QA site remain unchanged. Round 9 should not be promoted until each of the ten compositions passes unaided visual review at phone scale and the three silhouettes read from arrow paths alone.

## Accepted design direction

- Replace the former six active boards with ten new curated levels: seven abstract arrow weaves and three arrow-built silhouettes.
- Give every level a stable ID, catalog version, content version, chapter, difficulty, composition tag, design note, intended footprint, and frozen puzzle definition.
- Keep candidate generation as an offline authoring aid; never generate Adventure Mode content at runtime.
- Measure path occupancy and large gaps inside each authored footprint, closest-neighbor spacing, repeated interleaving, path and turn diversity, blocker relationships, safe openings, and dependency depth.
- Reject illegal self-geometry and stationary intersections. Use the actual movement simulator for gameplay, solver, catalog validation, and exact reachable-state auditing.
- Reset retired catalog progress through the versioned save boundary while preserving independent settings.

## Release gates

1. Manually select and refine all ten layouts; solver validity and density metrics do not substitute for composition quality.
2. Validate all path geometry and exhaustively audit every reachable state with no truncation.
3. Inspect complete starting arrangements at representative iPhone portrait viewports and play all ten boards on a physical iPhone.
4. Verify Round 9 save reset and settings preservation.
5. Run the full suite, TypeScript validation, production build, and QA-base build.
6. Deploy the complete catalog to the independent QA site, inspect the candidate there, then update production only after all release gates pass.

## Later work

Do not add levels beyond this ten-level opening set until its design has been playtested. Future roadmap mechanics—Free Play, black holes, switches, directional gates, and portals—remain out of scope until their movement, collision, solver, and tutorial rules have been separately specified.
