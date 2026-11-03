# Adventure Level Authoring and Review

Adventure Mode levels are curated published content. Generators may help designers find candidates, but the version-controlled puzzle definition is the published source of truth.

## Catalog location and record

The live catalog snapshots are `src/game/catalog/adventure-v1.json`, `adventure-v2.json`, and `adventure-v3.json`; runtime schema and validation live in `src/game/catalog.ts`. These files preserve levels 1–10, 11–20, and 21–40 respectively. Published puzzle definitions are static snapshots; later releases append a versioned file instead of regenerating earlier content.

| Display / sequence | Stable ID | Original seed | Arrows |
| ---: | --- | ---: | ---: |
| 1 | `first-flight-001` | `10632945` | 2 |
| 2 | `first-flight-002` | `10640865` | 3 |
| 3 | `first-flight-003` | `10648785` | 4 |
| 4 | `first-flight-004` | `10656705` | 5 |
| 5 | `first-flight-005` | `10664625` | 6 |
| 6 | `first-flight-006` | `10672545` | 7 |
| 7 | `first-flight-007` | `10680465` | 8 |
| 8 | `first-flight-008` | `10688385` | 9 |
| 9 | `first-flight-009` | `10696305` | 10 |
| 10 | `first-flight-010` | `10704226` | 12 |

Levels 11–20 are also in `first-flight`, each at content version 1 and tagged `standard-arrow`. They are authored snapshots and do not depend on runtime generation. Levels 11–14 were hand-authored to introduce up/down exits, then left exits and mixed dependencies. Levels 15–20 were selected from a deterministic candidate search after reviewing direction mix, path length, turn count, solvability, and opening-safe-move constraints; they were then frozen as literal puzzle definitions. This is a selection aid, not an assertion that generated difficulty is calibrated. The regression suite locks the original ten fingerprints and checks the expanded entries' stable IDs, versions, directional coverage, and solver results.

| Display / sequence | Stable ID | Content version | Difficulty | Arrows | Initial safe moves | Selection note |
| ---: | --- | ---: | --- | ---: | ---: | --- |
| 11 | `first-flight-011` | 1 | gentle | 3 | 1 | First up-facing arrow, with clear alternatives after opening |
| 12 | `first-flight-012` | 1 | easy | 4 | 1 | Up/down path and simple exit dependencies |
| 13 | `first-flight-013` | 1 | easy | 4 | 3 | First left exit and mixed directions |
| 14 | `first-flight-014` | 1 | medium | 5 | 1 | Multiple direction dependencies |
| 15 | `first-flight-015` | 1 | medium | 5 | 3 | Candidate-selected mix of all exits and winding paths |
| 16 | `first-flight-016` | 1 | medium | 5 | 3 | Candidate-selected mix of all exits and winding paths |
| 17 | `first-flight-017` | 1 | hard | 6 | 3 | More turns and dependencies |
| 18 | `first-flight-018` | 1 | hard | 6 | 2 | Constrained opening choices and mixed exits |
| 19 | `first-flight-019` | 1 | expert | 7 | 1 | Dense mixed-direction dependency puzzle |
| 20 | `first-flight-020` | 1 | expert | 7 | 3 | Dense combined foundational patterns |

Levels 21–40 add `diagonal-arrow` alongside `standard-arrow`, with content version 1 and authored provenance. The set was selected from deterministic candidate boards against progression constraints, then frozen as JSON snapshots. Level 21 carries `tutorialRef: diagonal-movement`; later levels do not repeat it. Difficulty labels are provisional and need playtesting.

| Display / sequence | Stable ID range | Content version | Progression target |
| ---: | --- | ---: | --- |
| 21–25 | `first-flight-021`–`first-flight-025` | 1 | Introduce diagonal paths and exits; Level 21 teaches crossings |
| 26–30 | `first-flight-026`–`first-flight-030` | 1 | Combine cardinal and diagonal route segments |
| 31–35 | `first-flight-031`–`first-flight-035` | 1 | Add winding mixed-direction paths |
| 36–40 | `first-flight-036`–`first-flight-040` | 1 | Increase dependencies and cover all eight exit headings as a set |

Each entry contains:

```ts
type AdventureLevel = {
  id: string; // stable, never reused, e.g. "first-flight-001"
  displayNumber: number; // player-facing number
  sequence: number; // progression position; independent from stable identity
  chapterId: string;
  contentVersion: number;
  difficulty: 'gentle' | 'easy' | 'medium' | 'hard' | 'expert';
  mechanicIds: ('standard-arrow' | 'diagonal-arrow' | 'black-hole' | 'switch' | 'directional-gate' | 'portal')[];
  tutorialRef?: string;
  authoringNotes?: string;
  provenance:
    | { kind: 'generated'; generatorId: string; generatorVersion: number; seed: number }
    | { kind: 'authored'; authoringSource?: string };
  puzzle: Level; // the exact board and arrows used by gameplay
};
```

This is the current runtime type. `standard-arrow` and `diagonal-arrow` have gameplay rules. Other mechanic tags remain metadata only. Level 21 uses the registered `diagonal-movement` tutorial, which is shown until dismissed and stored outside save schema v2. Future tutorial keys must be registered in `TUTORIAL_REFERENCES` before validation.

## Adding a curated level

1. **Choose a stable ID.** Use a readable lowercase chapter slug and permanent ordinal, such as `into-the-void-001`. IDs are save identities: do not derive them from array positions, display numbers, seeds, or mutable titles, and never reuse one for a different puzzle.
2. **Assign progression metadata.** Give the entry a unique player-facing `displayNumber`, a unique contiguous `sequence`, and a registered `chapterId`. Keep `sequence` separate from `id`; the numbered picker resolves its displayed number through the catalog. Progression unlocks resolve the next sequence through the catalog.
3. **Write the complete puzzle definition.** Add the arrow paths and board data to the JSON. An authored board uses `provenance: { "kind": "authored" }`. A board selected from a generator records its generator ID, immutable generator version, and seed. Keep the exact generated puzzle in the catalog even when provenance is recorded; gameplay loads the snapshot rather than generating a replacement at runtime.
4. **Set the content version.** A new ID starts at version 1. Keep the version and puzzle unchanged for non-behavioral metadata edits. If a published puzzle's gameplay definition changes, increment `contentVersion`, document the change, and intentionally update its regression fingerprint. Completion remains credited by stable ID across content versions, so players are not forced to replay a revised puzzle.
5. **Tag difficulty and mechanics.** Choose difficulty based on observed solution demands, not arrow count alone. Add only mechanics that the puzzle actually contains or uses; use the stable IDs listed in the type. An introduced mechanic remains eligible for later levels but is not required in every level. Add a tutorial reference only after its target exists.
6. **Add authoring notes if useful.** Keep rationale or review context in `authoringNotes`; do not put runtime behavior in this field.
7. **Add regression coverage.** Keep all catalog entries covered by structural and solver validation. Add an explicit frozen fingerprint or snapshot check for published content. For generated records, assert the archived generator version and seed reproduce the snapshot. Review any fingerprint change as a content change. A changed puzzle needs a deliberate content-version increment and review note.

## Eight-direction path and collision rules

Paths are arrays of integer grid points stored tail-to-head. Consecutive points may differ by at most one cell in each axis, excluding a zero-length step. This permits cardinal and diagonal segments, including paths that mix both. The final segment is the exit heading; diagonal continuation advances one grid point on both axes each frame.

Collision matches the rendered arrow geometry. The board renderer draws body paths through cell centers with a 0.46-cell stroke, so two body centerlines collide at distance `<= 0.46` board units. The geometry code adds `1e-8` tolerance for floating-point calculations. It checks segment-to-segment distance, so opposite diagonals crossing inside a cell collide even without a shared grid point. It also includes triangular arrowheads and treats shared endpoints or overlapping heads as collisions. Level validation applies the same visible-body geometry to all initial arrows and rejects nonadjacent self-crossing path segments. Do not author paths whose stroked lines touch or whose arrowheads overlap another arrow.

The solver and gameplay both call the same `simulateMove` and `arrowsCollide` functions. Every movement frame compares the moving arrow's complete polyline and head with each stationary arrow. If an apparent exit is blocked at any frame, the solver cannot use that move. New geometry tests cover all eight exit vectors, diagonal/crossing intersections, endpoint contacts, collision tolerance, and an exit that crosses a blocker between grid points.

The first diagonal level references `diagonal-movement`. Keep that tutorial concise: explain diagonal travel and exit direction, paths crossing between grid points, and checking the whole body. The UI records acknowledgement under a tutorial-specific local-storage key and does not alter save schema v2. Later levels are not tagged with this reference, so they do not interrupt play.

## Validation and publication

`validateCatalog` runs against all catalog entries and rejects:

- Duplicate or malformed stable IDs, display numbers, or progression sequences.
- Gaps in progression sequences, unknown chapter or tutorial references, and invalid difficulty/content-version metadata.
- Unsupported or duplicate mechanic tags and invalid generator provenance.
- Puzzle metadata that disagrees with the catalog, invalid paths, or illegal overlaps.
- Generated definitions that no longer reproduce exactly from their recorded generator/version/seed.
- Any puzzle for which the solver cannot find a complete solution.

Run the project checks before publishing catalog changes:

```sh
npm test
npm run typecheck
npm run build
```

The original ten entries have fixed fingerprints in the regression suite, and the original generator is retained for reproduction. All published catalog files are static snapshots; never regenerate Adventure layouts at app startup. For a new level, review the path map, directions, solver trace, dependencies, and at least one alternate solution if it exists. Do not silently update a published fingerprint: review the board change, increment content version, record why the change is needed, and preserve stable-ID completion credit.

## Difficulty and teaching review

Use several observable dimensions when assigning difficulty:

- Number of viable safe moves and how quickly they are apparent.
- Dependency depth and branching between valid removal orders.
- Path length, turns, arrow density, and visual proximity.
- Number of state changes a player must track.
- Number and interaction of enabled mechanics.
- Whether the intended solution requires planning several moves ahead.

The prototype had no difficulty field, so the original ten catalog labels are estimates based on their gradual arrow-count progression. Levels 11–20 also have provisional labels based on their structural complexity and candidate review. Neither set is a playtest rating; calibrate them on devices.

For First Flight directional teaching, introduce new exit directions in low-density examples with a clearly readable arrowhead, then combine directions and dependencies gradually. Confirm that new players recognize arrow direction independent of path orientation, can identify a safe exit by tracing the complete path, and understand why the tail follows the head. Watch for color-only distinctions, ambiguous near-touching paths, repeated blocked taps, and restarts. An automated solver proves only that a legal removal order exists; it does not prove that the intended teaching beat is clear or that difficulty feels fair.

For a new mechanic, begin with a low-complexity puzzle that makes the intended interaction legible, then add one complication at a time. Ask players to explain the rule in their own words. Observe incorrect assumptions, blocked selections, restarts, time to a useful move, and solution diversity. A solver proves solvability, not fairness or teaching quality. Review alternate valid solutions: if a lesson is intended to teach a mechanic, ensure that players cannot consistently bypass it without understanding it, unless that bypass is an intentional part of the lesson.

## Adding a chapter or milestone

Add a stable chapter ID and display title to `ADVENTURE_CHAPTERS` in `src/game/catalog.ts`, then update the provisional ranges and names in `docs/ROADMAP.md`. Add or adjust entries with the chapter ID and contiguous progression sequences. Mechanic introduction targets live in `MECHANIC_INTRODUCTIONS`; they are metadata targets, not numeric level checks in gameplay rules. Mark tentative targets provisional and revise them after playtesting. A chapter may include levels without its newly introduced mechanic, and later levels may use any suitable subset of available mechanics.

## Save and publication compatibility

Schema v2 stores highest-unlocked, selected, and completed state by stable level ID. The v1 numeric save is migrated through a fixed number-to-ID mapping for the original ten levels and kept intact as a recovery source. Do not remove or reuse published IDs. If an ID must be retired, add an explicit migration mapping and preserve its completion record. For later save formats, add an ordered migration from the preceding schema; validate and write the new record successfully before removing any old copy.

Do not reset progress when a puzzle receives a new content version. Because completion is attached to the stable ID, an already-completed level stays completed after a versioned revision. Record the content change and its review decision so its changed solution is not mistaken for the original historical puzzle.
