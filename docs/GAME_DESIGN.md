# Game Design and Puzzle Engine Direction

This document separates rules the prototype implements from design and architecture proposals. Planned mechanics are not live game behavior.

## Product shape

### Implemented prototype

- One mode: ten numbered puzzles, with the next level unlocked by completion and unlocked levels replayable.
- A puzzle contains standard winding arrows. A selected arrow advances along its connected body representation and continues in its terminal direction until its body leaves the board.
- A blocked move costs one of three hearts and leaves the arrow in place. Restart restores the level. There is no timer, undo, advertisement, reward currency, or power-up.
- Progress is stored locally under `mirpworks.arrow-adventure.save.v1` as `{ highestUnlocked, completed }`.

The current prototype generator produces a deterministic ten-level set. It is not the future Free Play mode or the planned curated Adventure catalog.

### Approved future product direction

- **Adventure Mode:** curated and deliberately sequenced levels with mechanic introductions, tutorials, progression, and increasing combinations.
- **Free Play:** separate solver-verified generated puzzles with difficulty and optional mechanic selection.
- A mechanic introduced in Adventure may appear again in any later level, alone or combined with other available mechanics, without being required in every later level.

## Mechanics

### Standard arrows — implemented foundation

An arrow is represented by ordered grid cells from tail to head. The prototype accepts connected, orthogonal, non-self-crossing paths; all arrows face east, and any occupied-cell overlap is invalid. Movement is simulated frame by frame against other arrows before it is committed. The prototype tests a complete exit and does not mutate the arrow on a failed attempt.

The current rule implementation has one exit direction and one interactive entity type. General direction vectors and object interaction are future work.

### Black holes — planned

Approved starting assumption: black holes are reusable. A hole absorbs an arrow that enters it directly along that arrow's movement path, and a successfully absorbed arrow is removed.

Still to decide:

- Whether a hole accepts entry from every direction or has an orientation.
- Whether entry is triggered by the head only, or by any segment of the moving body.
- How a hole competes with an arrow or another object for the same cell, including collision/absorption priority.
- Whether a hole blocks a path that passes over or ends at it without entering it.
- Whether absorption occurs at a cell boundary or after a dedicated animation, and what the visible feedback is.

Do not encode these assumptions in a solver until they are reviewed. Reusability means a hole's initial rule state does not become spent after absorption unless a later design decision changes that rule.

### Switch panels and directional gates — planned

An arrow physically strikes a switch panel. The switch changes the state or orientation of a linked gate; gate state affects subsequent arrow movement.

The fate of the arrow that strikes the switch is deliberately unresolved: it may be consumed, stopped, or continue. No implementation or solver contract should assume one of these outcomes. Also decide activation timing, whether repeat strikes toggle/cycle/reapply the gate, whether occupied gates can change orientation, and how a gate blocks or redirects the complete moving body.

### Portals — planned

Portals are linked in pairs. An arrow entering one should emerge from its partner, subject to a reviewed rule for:

- Whether entry is head-only or may occur under the body.
- How the full body is repositioned or routed through the pair.
- Exit direction and orientation.
- Occupancy checks at entry, inside the link, and at exit.
- Collision order against arrows and other objects near either endpoint.
- Re-entry, overlapping pairs, and the visible transit animation.

## Proposed engine boundary

The current implementation is small and direct:

- `Arrow` stores an ID, color, and path.
- `Level` stores a numeric level number, seed, dimensions, and arrows.
- `simulateMove` hardcodes eastward movement and checks cells occupied by stationary arrows.
- `solveLevel` searches for an arrow-removal order. Its memo key is the sorted set of remaining arrow IDs.

That solver key is sufficient for the current one-shot arrows: for a fixed remaining set, the board is unchanged. It is insufficient once switches can change gates or any interactive object can persist state.

### Proposed extension, to be introduced with the first approved interactive mechanic

Use a serializable, deterministic puzzle state rather than adding checks such as `if (level.number >= 41)`:

- Maintain a mechanic catalog keyed by stable IDs such as `standard-arrow`, `black-hole`, `switch-gate`, and `portal`. A catalog entry can carry its tutorial key and a proposed introduction target (`chapterId` plus sequence) separately from the rule implementation. After its introduction, a mechanic is eligible for later Adventure levels; eligibility does not mean every level uses it. These IDs are proposals to standardize before implementation.
- A **level definition** owns stable content identity, initial arrows, board objects, declared mechanic IDs, and tutorial/progression metadata.
- A **board state** contains the surviving/moving arrows and mutable object state. Static object definitions (such as portal links) remain separate from runtime state where practical.
- Each registered mechanic supplies focused behavior for definition validation, legal state transitions, collision/occupancy rules, and any state change it causes. Standard arrows remain a mechanic module too.
- A move simulation returns either a blocked result or an ordered sequence of state frames plus a terminal result (for example, exit or absorption). The UI animates those frames; it does not decide game rules.
- The solver explores legal state transitions and memoizes a canonical key containing all state that can affect future moves: remaining arrows and persistent object states such as gate orientations. Immutable level identity/configuration scopes the search. If rules permit cycles, repeated canonical states must be rejected.

This is a proposed boundary, not a request to add empty interfaces or speculative plugin infrastructure now. Implement only the state and mechanic contracts required by a decided mechanic; keep the standard-arrow regression suite passing during that migration.

For the current chapter targets, the proposed introduction targets are `standard-arrow` in First Flight, `black-hole` at the start of Into the Void, `switch-gate` at the start of Changing Paths, and `portal` at the start of Through the Looking Glass. Store these in mechanic/chapter metadata rather than treating numeric level ranges as rule logic. Revise the targets after playtesting.

### Free Play configuration proposal

An eventual generation request should explicitly record difficulty, enabled mechanic IDs, seed, generator version, and solver/rules version. Candidate generation must build only enabled mechanics, and the solver must prove a solution using only those mechanics. Replaying a seed across a generator change may require retaining the old generator or storing the resulting level definition; a seed alone is not a timeless content snapshot.

## Save and content compatibility

The current save format uses numeric unlock/completion state and must remain readable. Do not reinterpret the current key or overwrite progress during a catalog migration.

For the authored catalog, propose stable IDs such as `first-flight-001`, a separate integer `contentVersion`, and chapter/sequence metadata. Save completion by stable level ID in a new schema version while retaining the old completed-number and highest-unlocked fields during migration. Convert old level numbers using an explicit mapping for the initial ten levels. If the mapping is absent or a level is retired, preserve the old record for recovery and avoid granting progress by accidentally matching a different puzzle at the same number.

Content changes to a published puzzle should either keep its behavior and version unchanged or create an explicit new content version. Tests and release review should flag changed published definitions and solver traces. Whether past completions count for a revised version is a product decision; do not silently reset or silently mark it complete.

## Open decisions register

| Topic | Current position | Decision needed before implementation |
| --- | --- | --- |
| Black hole reuse | Reusable is the initial assumption | Keep as rule or revise; define entry direction, entry trigger, collision priority, and animation |
| Switch-hit arrow | Not decided | Consumed, stopped, or continues; define timing and repeated activation |
| Gate behavior | State/orientation changes after switch | Define gate geometry, affected movement, occupied-gate behavior, and collision rules |
| Portal body behavior | Paired endpoints | Define body transit, exit direction/orientation, occupancy, collisions, and re-entry |
| Revised level completion | Not decided | Decide whether content version changes reset, preserve, or grandfather completion |
| Seed replay lifetime | Seed plus generator/config versions proposed | Decide whether to retain generators or persist generated definitions |
