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

On catalog import and in the automated suite, each entry is checked for valid metadata and board geometry. The validator rejects out-of-bounds or disconnected paths, repeated points, visible self-intersections, duplicate arrow IDs, and overlaps between stationary arrows. It also runs `analyzeLevel`: segment proximity is measured directly (not inferred from overlapping bounding boxes), and each released board must contain at least one pair with three or more close route segments on both arrows plus at least eight close segment contacts overall. It then runs the solver. An unsolvable, weakly interleaved, or malformed entry prevents the catalog from loading.

The solver searches removal orders by calling `simulateMove`. Gameplay calls that same function before starting a move. Movement vertices are sampled by distance along the complete route, including bends and final exit extension. The visual animation uses the same position function on a `requestAnimationFrame` clock; it is independent of collision sampling. The simulator checks the complete body and arrowhead every 0.05 cells and adds the sample interval to collision clearance, conservatively covering between-sample travel. Avoid paths whose visible strokes or heads nearly touch unless the resulting interaction is intentional and tested.

## Curation and review

Use candidate sketches or scripts only as authoring aids; store the final board as a fixed definition in the catalog. Before adding a level, review:

- Path length, irregularity, turn count, and proportion of diagonal segments.
- Number of safe first moves, dependency depth, and alternative valid sequences.
- How closely paths share the board while remaining visually distinct.
- `analyzeLevel` results: interleaved pair count, close segment contacts, initial safe moves, newly unlocked arrows, dependency depth, path lengths, and turn counts. Reject layouts that pass solvability but miss the catalog's interleaving thresholds.
- Whether the player can trace each arrow and understand why a blocked move fails.
- Touch selection and line contrast at a phone-sized viewport.
- Review the board as one complete composition at phone scale. Reject puzzles whose bounding boxes overlap while their actual paths sit in separate lanes; proximity counts alone do not prove interlocking.
- Check the board at Thin, Medium, and Bold stroke widths. The solver and stationary validation must agree at each selectable width.

Run the solver and the full test/build checks, then play the board manually. A solution proves solvability but not clarity, fairness, or calibrated difficulty. Check hit selection on close neighboring paths and verify that a blocked first tap deducts exactly one heart. Keep the prototype to the smallest set that communicates the design; do not add levels to meet a quota.

For future dense boards, author the intended packed silhouette first, then route each arrow through shared corridors while preserving clearance beyond the body/head collision envelope. Freeze paths as catalog data only after solver validation at all supported line widths. Visually inspect a full-board render and use the QA panel's ownership and hit-target diagnostics to check arrow ownership and adjacent-path selection. The current six boards have not yet been replaced with this denser style; the Round 4 request requires its three reference screenshots before that geometry work proceeds.

## Session and persistence

This reset prototype does not save progress. The page starts at Level 1, level completion advances in memory, and restart returns to the current definition with three hearts. Do not add storage reads or writes until the redesigned content model has been reviewed. Previous release storage keys may remain in a browser but must stay unused.
