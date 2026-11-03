# Arrow Adventure Roadmap

This roadmap records the approved product direction and provisional chapter plan. Chapter ranges and mechanic milestones are planning targets, not release commitments. Playtesting may change the order, length, or teaching pace.

## Status at a glance

### Implemented

- A standalone browser game with forty stable, solver-checked Adventure levels.
- Winding arrows with all eight compass directions, continuous visible-geometry collision checks, collision failures, three hearts, restart, numbered progression, and browser-local progress saving.
- A mobile-first SVG interface and a GitHub Pages build/deployment workflow.
- A curated Adventure catalog for levels 1–40, with stable IDs, display numbers, progression sequences, chapter IDs, content versions, difficulty tags, mechanic tags, and generated/authored provenance.
- A one-time diagonal movement tutorial at Level 21, with acknowledgement saved separately from progression save schema v2.
- Save schema v2 keyed by stable level IDs, with a non-destructive migration from the prototype's numeric schema.
- Approved official logo on the welcome screen, proportional browser/install icon derivatives, and a base-path-safe standalone web app manifest.

These are the current release's actual capabilities. The future modes and mechanics below are not implemented.

### Approved direction

- Keep Arrow Adventure a calm, mobile-first Mirpworks puzzle game.
- Develop two distinct modes: a curated, stable Adventure Mode and a separate solver-verified Free Play mode.
- Introduce mechanics deliberately: teach one in approachable puzzles, deepen it, and later combine it with previously introduced mechanics.
- Keep a mechanic eligible for later puzzles after its introduction; do not make it mandatory in every subsequent puzzle.
- Keep every published Adventure puzzle reproducible, reviewed, and protected from silent content changes.
- Do not implement a planned mechanic until its player-facing behavior and solver rules have been decided.

### Provisional Adventure chapters

| Target levels | Chapter | Planned focus |
| --- | --- | --- |
| 1–40 | First Flight | Standard and diagonal arrows; foundational path-reading puzzles |
| 41–60 | Into the Void | Introduce and develop black holes |
| 61–85 | Changing Paths | Introduce switches and directional gates |
| 86–110 | Through the Looking Glass | Introduce portals |
| 111–140 | Worlds Collide | Optional combinations of unlocked mechanics |

The chapter names, ranges, and introduction points are provisional. A chapter may contain puzzles that do not use its newly introduced mechanic, and later chapters may use any suitable subset of previously introduced mechanics.

## Development sequence

1. **Complete — Protect the prototype.** Preserve the first ten playable levels, snapshot their definitions, and retain the original numeric save as a migration source.
2. **Complete — Establish the catalog.** Register levels 1–20 with stable IDs and content metadata. The original ten retain their generated snapshots and seeds; the expansion is frozen authored content.
3. **Next — Review First Flight on devices.** Playtest the 40 levels on iPhone Safari and desktop, calibrate difficulty, confirm diagonal crossing feedback and path legibility, and revise only through explicit content-version changes.
4. **Define the stateful rules boundary.** Move future solver and movement decisions toward pure state transitions over arrows and board objects. Do this alongside the first designed interactive mechanic, with tests for current standard-arrow behavior.
5. **Design and playtest one mechanic at a time.** Resolve its rules, implement it behind a mechanic-specific rule module, author a small teaching sequence, and review player understanding before adding another mechanic.
6. **Build Free Play as a separate mode.** Add difficulty, mechanic toggles, generation metadata, and seed replay without changing Adventure completion or unlock progression.
7. **Combine mechanics after individual rules are stable.** Use authored review and the stateful solver to verify combinations before publication.

These are sequencing recommendations, not a schedule. Eight-direction movement and its shared geometry solver are in place; future gameplay mechanics should wait for explicit design decisions and First Flight playtesting.

## Future Free Play

Free Play is planned as a separate route from Adventure Mode. Its eventual setup should offer:

- A difficulty choice that maps to documented generation constraints.
- Per-mechanic toggles, including standard arrows as the baseline.
- A reproducible puzzle seed, generator version, and configuration record.
- Solver verification before a generated puzzle is shown.
- Tutorial or rules access for each enabled mechanic.
- Generation that excludes disabled mechanics and whose solution does not depend on one.
- Separate completion/session state; Free Play results must not unlock or rewrite Adventure levels.

No Free Play interface or generator is included in the current prototype.

## Release gates for future mechanics

Before a mechanic enters an Adventure release, its rule sheet should define entry/activation conditions, complete-body movement, collision priority, resulting board state, solver representation, animation endpoints, and edge cases. The design should have unit tests, curated teaching levels, reviewed solution traces, and a migration plan for saved progression and level content.
