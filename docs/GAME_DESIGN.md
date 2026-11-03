# Game Design and Puzzle Engine Direction

This document separates rules the prototype implements from design and architecture proposals. Planned mechanics are not live game behavior.

## Product shape

### Implemented prototype

- One mode: forty numbered puzzles, with the next level unlocked by completion and unlocked levels replayable.
- A puzzle contains winding arrows with cardinal and diagonal paths. A selected arrow advances along its connected body representation and continues in its terminal direction until its body leaves the board.
- A blocked move costs one of three hearts and leaves the arrow in place. Restart restores the level. There is no timer, undo, advertisement, reward currency, or power-up.
- Progress is stored locally under `mirpworks.arrow-adventure.save.v2` using stable level IDs. Existing `mirpworks.arrow-adventure.save.v1` numeric saves migrate on load and remain in storage as a recovery source.
- The original ten puzzles are literal catalog snapshots with stable IDs, progression sequences, chapter/difficulty/mechanic metadata, content version 1, and the original generator provenance. Levels 11–40 are versioned authored snapshots.
- Catalog lookup is by stable ID, display number, or progression sequence. The UI keeps its numbered picker, while unlock and completion state use catalog IDs.

### Branding assets

The welcome screen uses the approved full-composition logo at `public/branding/arrow-adventure-official-logo.png`. This is the master artwork and should remain unchanged. Browser and install icon derivatives are stored separately in `public/icons/` and are proportional resizes of the master. `public/site.webmanifest` provides the app name, standalone display mode, colors, and install icon references. HTML branding links and the welcome-screen image use Vite's `/arrow-adventure/` base path.

The original tile-serpentine generator remains available as a version-1 reproduction function and regression reference. Adventure Mode loads the catalog snapshots, not newly generated layouts. This catalog is not the future Free Play mode.

### Prototype-to-catalog compatibility findings

| Before this catalog | Catalog release |
| --- | --- |
| Levels were identified by displayed number and generated from a deterministic seed formula; no stable level ID or stored board snapshot existed. | Each original puzzle is now stored as a literal snapshot with a stable ID, displayed number, separate progression sequence, and generator/version/seed provenance. |
| No difficulty metadata existed, so there was no prior difficulty value to preserve. | Initial difficulty labels are estimates based on the existing gradual arrow-count sequence; playtest calibration is still needed. |
| Chapter, mechanic, content-version, and tutorial metadata were absent. | Catalog entries include chapter, content version, mechanic tags, and an optional validated tutorial reference. No tutorial content or advanced mechanic behavior was added. |
| V1 saves stored `highestUnlocked` and `completed`; the selected level lived only in memory and was not saved. | V2 stores IDs for highest unlocked, completed, and selected levels. V1 migration defaults selection to the highest unlocked level and leaves the v1 key intact. |

### Approved future product direction

- **Adventure Mode:** curated and deliberately sequenced levels with mechanic introductions, tutorials, progression, and increasing combinations.
- **Free Play:** separate solver-verified generated puzzles with difficulty and optional mechanic selection.
- A mechanic introduced in Adventure may appear again in any later level, alone or combined with other available mechanics, without being required in every later level.

## Mechanics

### Standard arrows — implemented foundation

An arrow is represented by ordered grid points from tail to head. Each step can be one cell in any of eight directions; the final step determines the exit heading. Routes may combine cardinal and diagonal steps. The geometry validator rejects self-crossings, path gaps, and visually overlapping arrows.

Movement advances the tail-to-head body along its stored route, then extends the head on its final compass heading while the tail follows. Before committing, the simulator checks every body segment and arrowhead against every stationary arrow. The solver calls the same simulator. A blocked move costs one heart and changes no arrow geometry; an escape completes only after the full body is outside the board.

#### Collision geometry

Arrow body polylines are rendered through grid-cell centers with a 0.46-cell SVG stroke. Collision uses continuous segment-to-segment distance, not occupied grid cells. Centerline distances at or below 0.46 board units (plus `1e-8` floating-point tolerance) collide, matching overlap of the two visible body strokes. The triangular arrowhead polygon and its 0.08-cell outline are included in stationary and moving geometry. Endpoint contact and diagonal crossings between grid points therefore count. Path validation applies the same line-distance rule to nonadjacent segments of one arrow to reject ambiguous self-crossings. Grid coordinates remain integers in saved definitions; floating-point arithmetic is used only in the geometry calculations.

The catalog mechanic ID `diagonal-arrow` is introduced at sequence 21 and is implemented. The other catalog mechanic IDs remain metadata only; they do not activate new rules.

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

The current rule engine remains small and direct:

- `Arrow` stores an ID, color, and path.
- `Level` stores a numeric display number, optional seed, dimensions, and arrows. The seed is present for frozen generated legacy levels; authored entries store their exact definition.
- `simulateMove` derives one of eight grid-step headings from the last two path points and uses shared rendered-geometry collision checks for each frame.
- `solveLevel` searches for an arrow-removal order. Its memo key is the sorted set of remaining arrow IDs.

That solver key is sufficient for the current one-shot arrows: for a fixed remaining set, the board is unchanged. It is insufficient once switches can change gates or any interactive object can persist state.

The level catalog and mechanic-ID metadata are implemented in `src/game/catalog.ts` and versioned snapshots `src/game/catalog/adventure-v1.json` through `adventure-v3.json`. These preserve levels 1–10, 11–20, and 21–40 respectively. The catalog validator checks stable IDs, display numbers, sequence numbers, chapter/tutorial references, content versions, supported mechanic tags, level geometry, known generator provenance, exact reproduction, and solvability. It does not add interactive-object state to the current solver.

The diagonal movement introduction is attached to Level 21 with tutorial reference `diagonal-movement`. The concise tutorial is shown only until dismissed and stored in a dedicated local-storage key, independent of the unchanged progression save schema v2.

### Proposed extension, to be introduced with the first approved interactive mechanic

Use a serializable, deterministic puzzle state rather than adding checks such as `if (level.number >= 41)`:

- The implemented mechanic-ID list and provisional `MECHANIC_INTRODUCTIONS` metadata already separate eligibility targets from the actual rules. Add a mechanic's rule implementation only after its design is approved; the advanced IDs accepted in level metadata do not enable gameplay. After introduction, a mechanic is eligible for later Adventure levels; eligibility does not mean every level uses it.
- A **level definition** owns stable content identity, initial arrows, board objects, declared mechanic IDs, and tutorial/progression metadata.
- A **board state** contains the surviving/moving arrows and mutable object state. Static object definitions (such as portal links) remain separate from runtime state where practical.
- Each registered mechanic supplies focused behavior for definition validation, legal state transitions, collision/occupancy rules, and any state change it causes. Standard arrows remain a mechanic module too.
- A move simulation returns either a blocked result or an ordered sequence of state frames plus a terminal result (for example, exit or absorption). The UI animates those frames; it does not decide game rules.
- The solver explores legal state transitions and memoizes a canonical key containing all state that can affect future moves: remaining arrows and persistent object states such as gate orientations. Immutable level identity/configuration scopes the search. If rules permit cycles, repeated canonical states must be rejected.

This is a proposed boundary, not a request to add empty interfaces or speculative plugin infrastructure now. Implement only the state and mechanic contracts required by a decided mechanic; keep the standard-arrow regression suite passing during that migration.

Current provisional targets are `standard-arrow` at First Flight sequence 1, `diagonal-arrow` at sequence 21, `black-hole` at Into the Void sequence 41, `switch` and `directional-gate` at sequence 61, and `portal` at sequence 86. Store these in mechanic/chapter metadata rather than treating numeric level ranges as rule logic. Revise targets after playtesting.

### Free Play configuration proposal

An eventual generation request should explicitly record difficulty, enabled mechanic IDs, seed, generator version, and solver/rules version. Candidate generation must build only enabled mechanics, and the solver must prove a solution using only those mechanics. Replaying a seed across a generator change may require retaining the old generator or storing the resulting level definition; a seed alone is not a timeless content snapshot.

## Save and content compatibility

The v1 numeric format is migrated to schema v2 using an explicit, fixed mapping from each of the original ten numbers to its stable ID. It does not infer IDs from catalog order or a future display-number arrangement. V2 stores `highestUnlockedLevelId`, `selectedLevelId`, and `completedLevelIds`. The shipped v1 format did not store a selected level, so migration defaults selection to the highest unlocked level, matching the prototype's Continue behavior. Starting/replaying a level now persists its ID. V1 is never deleted or overwritten; v2 is written only after a complete migration value is serialized. Repeated loads use v2 and produce the same state. A failed v2 write leaves v1 available for retry.

Completion is keyed by stable level ID, not content version, so revising a published level while retaining its ID preserves completion credit. A new content version still requires intentional review and an updated regression fingerprint. Do not silently reset progression. Retiring or re-identifying a published level requires an explicit mapping and save migration.

For future save schemas, introduce a new schema version and a sequential migration from the last supported version. Preserve the previous key until the new record has been validated and written successfully. Unknown or malformed data must not be interpreted as extra unlocks/completions; keep an untouched recovery copy where possible. Never reuse a stable level ID for a different puzzle.

## Open decisions register

| Topic | Current position | Decision needed before implementation |
| --- | --- | --- |
| Black hole reuse | Reusable is the initial assumption | Keep as rule or revise; define entry direction, entry trigger, collision priority, and animation |
| Switch-hit arrow | Not decided | Consumed, stopped, or continues; define timing and repeated activation |
| Gate behavior | State/orientation changes after switch | Define gate geometry, affected movement, occupied-gate behavior, and collision rules |
| Portal body behavior | Paired endpoints | Define body transit, exit direction/orientation, occupancy, collisions, and re-entry |
| Revised level completion | Not decided | Decide whether content version changes reset, preserve, or grandfather completion |
| Seed replay lifetime | Seed plus generator/config versions proposed | Decide whether to retain generators or persist generated definitions |
