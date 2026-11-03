# Adventure Level Authoring and Review

Adventure Mode levels are curated published content. Generators may help designers find candidates, but the version-controlled puzzle definition is the published source of truth.

## Catalog location and record

The live catalog is `src/game/catalog/adventure-v1.json`; the runtime schema and validation live in `src/game/catalog.ts`. The first ten records are frozen snapshots of the original prototype puzzles.

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

Each entry contains:

```ts
type AdventureLevel = {
  id: string; // stable, never reused, e.g. "first-flight-001"
  displayNumber: number; // player-facing number
  sequence: number; // progression position; independent from stable identity
  chapterId: string;
  contentVersion: number;
  difficulty: 'gentle' | 'easy' | 'medium' | 'hard' | 'expert';
  mechanicIds: ('standard-arrow' | 'black-hole' | 'switch' | 'directional-gate' | 'portal')[];
  tutorialRef?: string;
  authoringNotes?: string;
  provenance:
    | { kind: 'generated'; generatorId: string; generatorVersion: number; seed: number }
    | { kind: 'authored'; authoringSource?: string };
  puzzle: Level; // the exact board and arrows used by gameplay
};
```

This is the current runtime type. Mechanic tags are metadata only; only standard arrows have gameplay rules today. No tutorial content exists yet, so current entries omit `tutorialRef`. A future tutorial key must be registered in `TUTORIAL_REFERENCES` before it can validate.

## Adding a curated level

1. **Choose a stable ID.** Use a readable lowercase chapter slug and permanent ordinal, such as `into-the-void-001`. IDs are save identities: do not derive them from array positions, display numbers, seeds, or mutable titles, and never reuse one for a different puzzle.
2. **Assign progression metadata.** Give the entry a unique player-facing `displayNumber`, a unique contiguous `sequence`, and a registered `chapterId`. Keep `sequence` separate from `id`; the numbered picker resolves its displayed number through the catalog. Progression unlocks resolve the next sequence through the catalog.
3. **Write the complete puzzle definition.** Add the arrow paths and board data to the JSON. An authored board uses `provenance: { "kind": "authored" }`. A board selected from a generator records its generator ID, immutable generator version, and seed. Keep the exact generated puzzle in the catalog even when provenance is recorded; gameplay loads the snapshot rather than generating a replacement at runtime.
4. **Set the content version.** A new ID starts at version 1. Keep the version and puzzle unchanged for non-behavioral metadata edits. If a published puzzle's gameplay definition changes, increment `contentVersion`, document the change, and intentionally update its regression fingerprint. Completion remains credited by stable ID across content versions, so players are not forced to replay a revised puzzle.
5. **Tag difficulty and mechanics.** Choose difficulty based on observed solution demands, not arrow count alone. Add only mechanics that the puzzle actually contains or uses; use the stable IDs listed in the type. An introduced mechanic remains eligible for later levels but is not required in every level. Add a tutorial reference only after its target exists.
6. **Add authoring notes if useful.** Keep rationale or review context in `authoringNotes`; do not put runtime behavior in this field.
7. **Add regression coverage.** Add the new stable ID and a frozen puzzle fingerprint to `tests/game.test.ts`. For generated records, assert the archived generator version and seed reproduce the snapshot. Review any fingerprint change as a content change.

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

The original ten entries have fixed fingerprints in the regression suite, and the original generator is retained for reproduction. A future catalog change must add its fingerprint to the exact expected-ID set; this makes an unreviewed definition change or an unprotected new entry fail tests. A reviewer should inspect the puzzle diff and solution trace before intentionally updating a fingerprint. Keep reviewed catalog edits in version control and never regenerate published Adventure layouts at app startup.

## Difficulty and teaching review

Use several observable dimensions when assigning difficulty:

- Number of viable safe moves and how quickly they are apparent.
- Dependency depth and branching between valid removal orders.
- Path length, turns, arrow density, and visual proximity.
- Number of state changes a player must track.
- Number and interaction of enabled mechanics.
- Whether the intended solution requires planning several moves ahead.

The prototype had no difficulty field, so the first ten catalog labels are initial estimates based on the original gradual arrow-count progression. They are not established playtest ratings and should be calibrated when levels are reviewed on devices.

For a new mechanic, begin with a low-complexity puzzle that makes the intended interaction legible, then add one complication at a time. Ask players to explain the rule in their own words. Observe incorrect assumptions, blocked selections, restarts, time to a useful move, and solution diversity. A solver proves solvability, not fairness or teaching quality. Review alternate valid solutions: if a lesson is intended to teach a mechanic, ensure that players cannot consistently bypass it without understanding it, unless that bypass is an intentional part of the lesson.

## Adding a chapter or milestone

Add a stable chapter ID and display title to `ADVENTURE_CHAPTERS` in `src/game/catalog.ts`, then update the provisional ranges and names in `docs/ROADMAP.md`. Add or adjust entries with the chapter ID and contiguous progression sequences. Mechanic introduction targets live in `MECHANIC_INTRODUCTIONS`; they are metadata targets, not numeric level checks in gameplay rules. Mark tentative targets provisional and revise them after playtesting. A chapter may include levels without its newly introduced mechanic, and later levels may use any suitable subset of available mechanics.

## Save and publication compatibility

Schema v2 stores highest-unlocked, selected, and completed state by stable level ID. The v1 numeric save is migrated through a fixed number-to-ID mapping for the original ten levels and kept intact as a recovery source. Do not remove or reuse published IDs. If an ID must be retired, add an explicit migration mapping and preserve its completion record. For later save formats, add an ordered migration from the preceding schema; validate and write the new record successfully before removing any old copy.

Do not reset progress when a puzzle receives a new content version. Because completion is attached to the stable ID, an already-completed level stays completed after a versioned revision. Record the content change and its review decision so its changed solution is not mistaken for the original historical puzzle.
