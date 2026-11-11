# Round 9E — Square Weave

## Status and isolation

Round 9E adds exactly one experimental puzzle, `prototype-square-15`, at content version 1. It is stored in `src/game/prototypes/round9e-square-15.json`; it is not in the Adventure catalog and has not been added to the QA Prototype Review selector. It does not change normal progress or saves. There is no runtime generator for this prototype.

The final coordinates are frozen. Deterministic layout search was used to explore board-wide packed candidates, then the selected composition was tuned at whole-arrow offsets on the existing half-cell lattice and saved as explicit puzzle data. This was a one-off authoring aid, not procedural content presented to players. The stable puzzle fingerprint is `0551c66eeacbcc180a738caf71d180fce31eb58545b3cf6f431ff1e8c4f092ba`.

## Board and movement geometry

The board is 15 by 15 **cells**. The visible grid is spaced every 0.5 board units. Path coordinates use the engine’s path-local frame; adding `PATH_POINT_OFFSET` (0.5) maps them to displayed grid intersections. Each stored segment advances exactly one board unit, horizontally or vertically. This prototype has no diagonals.

The play area uses the existing body width (0.12), head, tail marker, nearest-path touch selection, movement sweep, and solver. Collision clearance is unchanged. The arrangement reaches all four square edges, with path-local bounds x=0..14.5 and y=0.5..14.5. At the rendered edge, the normal arrowhead and stroke margins extend slightly past the board boundary, as in the existing renderer.

## Composition and route mix

The board is a single irregular orthogonal weave, with routes crossing the full footprint and threading around neighboring routes. Short routes occupy interior pockets; medium routes connect several corridor groups; the long routes establish much of the board-wide structure. There are 15 arrows total:

| Group | Route lengths | Count |
| --- | --- | ---: |
| Long | 18, 17, 16, 15 | 4 |
| Medium | 12, 11, 10, 9, 8, 6 | 6 |
| Short | 4, 4, 3, 3, 2 | 5 |

All routes are orthogonal and have varied turn counts. No arrow is a decorative marker; every path participates in the movement and removal rules.

## Validation and measured composition

The regression test validates every arrow and the complete board with the same geometry and movement code used by gameplay. It checks that the puzzle remains within the solver’s exact-audit limit, compares an entire solver sequence against `simulateMove`, and exhaustively visits every reachable successful-removal state.

Current measurements:

* Total path length: 138 board units (0.613 of board area as the authoring occupancy ratio).
* Distinct paths with a neighboring segment corridor: 73.2% of route length is within 0.75 units of another path.
* Nearest distinct-path clearance: 0.5 units minimum, 0.5 at the 10th percentile and median.
* Parallel neighboring corridor length: 15.5 units.
* Interleaved arrow pairs: 15.
* Blocking relationships: 27; dependency depth: 5; initially removable arrows: 3.
* Large-gap sample ratio: 7.17% of the square is farther than 1.5 units from every arrow centerline, sampled at 0.25-unit spacing. This is a geometric guide rather than a visual-quality verdict.
* Exact state audit: 286 reachable states and 921 legal removal transitions, with one terminal state, no deadlocks, and no dependency cycles.

The selected level’s paths are frozen by the fingerprint test. Changing a route intentionally requires reviewing its previews and updating that fingerprint after all geometry and solver tests pass.

## Previews

Regenerate the faithful Arrow Adventure style previews from the frozen level with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/render-round9e-preview.ps1
```

Outputs are under `docs/previews/round-9e/`:

* `square-weave.png` — full 15×15 composition.
* `square-weave-iphone.png` — 390×844 portrait gameplay preview.
* `square-weave-diagnostic.png` — route IDs over the same geometry.

These are review assets only; they are not shipped into the application bundle.

## Review limits

The geometry test samples each arrow’s centerline for hit selection and checks fit-to-content bounds at phone and landscape viewport sizes. It does not replace a physical iPhone Safari playtest. The puzzle is intentionally not selectable through QA yet: the developer should first approve its composition here, then a separate change can add it to the QA review menu.
