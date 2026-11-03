# Prototype Level Authoring

## Active catalog format

Add new authored entries to `CURATED_LEVELS` in `src/game/catalog.ts`. A record looks like:

```ts
{
  id: 'shared-board-007',
  number: 7,
  title: 'Working title',
  difficulty: 'steady',
  designNote: 'What this board teaches or asks the player to notice.',
  puzzle: {
    number: 7,
    width: 10,
    height: 10,
    arrows: [
      { id: 'a', path: [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 }] },
    ],
  },
}
```

Use unique lowercase IDs and contiguous player-facing numbers beginning at 1. Paths are integer board points ordered tail-to-head. Each step must be adjacent in one of eight directions. The last segment determines the heading after the arrow reaches the end of its stored body path. All arrows use the same monochrome style; color does not identify paths.

## Validation rules

On catalog import and in the automated suite, each entry is checked for valid metadata and board geometry. The validator rejects out-of-bounds or disconnected paths, repeated points, visible self-intersections, duplicate arrow IDs, and overlaps between stationary arrows. It then runs the solver. An unsolvable or malformed entry prevents the catalog from loading.

The solver searches removal orders by calling `simulateMove`. Gameplay calls that same function. Movement frames interpolate the body as each point follows the next route point and the head extends along its final heading; collision checks include the complete rendered body and arrowhead at each returned substep. Avoid paths whose visible strokes or heads nearly touch unless the resulting interaction is intentional and tested.

## Curation and review

Use candidate sketches or scripts only as authoring aids; store the final board as a fixed definition in the catalog. Before adding a level, review:

- Path length, irregularity, turn count, and proportion of diagonal segments.
- Number of safe first moves, dependency depth, and alternative valid sequences.
- How closely paths share the board while remaining visually distinct.
- Whether the player can trace each arrow and understand why a blocked move fails.
- Touch selection and line contrast at a phone-sized viewport.

Run the solver and the full test/build checks, then play the board manually. A solution proves solvability but not clarity, fairness, or calibrated difficulty. Keep the prototype to the smallest set that communicates the design; do not add levels to meet a quota.

## Session and persistence

This reset prototype does not save progress. The page starts at Level 1, level completion advances in memory, and restart returns to the current definition with three hearts. Do not add storage reads or writes until the redesigned content model has been reviewed. Previous release storage keys may remain in a browser but must stay unused.
