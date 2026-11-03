# Adventure Level Authoring and Review

Adventure Mode levels are intended to be curated published content. A generator may help designers find candidates, but the published level definition—not a changing random generator result—is the source of truth.

## Proposed level record

Before expanding the authored catalog, define a validated schema with at least:

```ts
type AdventureLevelDefinition = {
  id: string;                 // Stable identity, e.g. "first-flight-001"
  contentVersion: number;     // Increment only for an intentional content revision
  chapterId: string;          // Stable chapter key, independent of displayed chapter title
  sequence: number;           // Human-facing progression position
  dimensions: { width: number; height: number };
  mechanics: string[];        // Declared mechanic IDs used by the definition
  tutorialKey?: string;       // Content key, not hardcoded UI copy
  difficulty: 'gentle' | 'easy' | 'medium' | 'hard' | 'expert';
  board: unknown;             // Replace with the reviewed discriminated board schema
};
```

This is illustrative documentation, not a committed runtime type. Avoid using displayed level numbers as mechanic switches or as the permanent save identity.

## Authoring pipeline

1. **Create a draft.** Author the board in a readable source definition with a stable proposed ID. Declare only mechanics present in the puzzle, plus its intended tutorial reference and target difficulty.
2. **Run structural validation.** Check schema/version, unique IDs, supported mechanic IDs, board bounds, connected paths, arrow heads, illegal overlaps, object links (including paired portals), and any mechanic-specific constraints.
3. **Verify solutions.** Run the solver against the complete state model, record at least one solution trace, and check that all intermediate body cells and board-object transitions obey collision rules. Reject any unsolved or ambiguous candidate.
4. **Review difficulty and intent.** Assign difficulty from actual solution demands, not arrow count alone. Add tags for mechanics and relevant skills such as exit scanning, ordering, or state tracking. Confirm that the candidate teaches what its metadata claims.
5. **Playtest the teaching sequence.** For a new mechanic, begin with a low-complexity puzzle whose intended interaction is legible, then add one complication at a time. Ask players to explain the mechanic in their own words. Observe incorrect assumptions, blocked selections, restarts, time to first useful move, and solution diversity. Revise tutorial or puzzle order when players succeed by guessing without understanding.
6. **Approve and publish.** A reviewer confirms rule clarity, solution trace, visual readability on a phone, intended mechanic use, and chapter fit. Add the fixed definition and its version to the catalog; never generate a published Adventure board afresh from a seed at runtime.
7. **Protect published content.** CI validates every catalog entry and solver result. Keep approved definitions in version control, compare content hashes or snapshots, and require an intentional review for edits to a published ID/version. A changed puzzle gets a new content version and a documented progression/save decision.

## Difficulty guidance

Use several observable dimensions:

- Number of viable safe moves and how quickly they are apparent.
- Dependency depth and branching between valid removal orders.
- Path length, turns, arrow density, and visual proximity.
- Number of state changes a player must track.
- Number and interaction of enabled mechanics.
- Whether the intended solution requires planning several moves ahead.

Difficulty is a human-facing estimate. The solver proves solvability, not fairness or teaching quality. Review difficulty through playtests and adjust metadata when the observed experience disagrees.

## Mechanic introduction guidance

- A tutorial should explain the rule before or at the point of first use, and remain accessible later from Free Play and any mechanic reference screen.
- Early teaching puzzles should isolate the new mechanic where practical. Do not combine multiple unfamiliar mechanics in the first teaching step.
- Later puzzles can deepen and combine mechanics. A mechanic remains eligible for future content but may be absent from any particular puzzle.
- A puzzle tagged for a mechanic should require players to understand it when the intent is to teach it. If an alternate solution bypasses it, either accept that as a deliberate lesson or revise the puzzle and metadata.
- Verify both the full set of valid solutions and the intended teaching solution; one solver trace alone does not show that the lesson is unambiguous.

## Free Play candidate handling

Generated Free Play boards are not Adventure catalog entries by default. Store enough generation metadata to reproduce them, verify them with the ruleset corresponding to their enabled mechanics, and keep their session/results outside Adventure unlock progress. A disabled mechanic must be absent from generated definitions and must not be needed in any accepted solution.
