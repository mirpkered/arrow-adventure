# Solvability audit — Round 6

## Production baseline and Level 4 finding

The original Round 6 solvability audit used production commit `fea155816c19d9a03ea30f2a0235562ee280a27f`. At the start of this self-geometry addendum, production source was `f719f5366846bcc9814d65722118233c8ce0d306`. Level 4 is stable catalog entry `shared-board-004` (“Interwoven Board”), board 14×12 with 10 arrows. Its pre-addendum puzzle SHA-256 was `f620176b5b5710bfe7175e7f49cbd3646b096fdc7872c73f217318d0fbeab675`; current fingerprints for changed Levels 3, 4 and 6 are asserted in `tests/game.test.ts`.

The two iPhone screenshots mentioned in the report were not present among this turn’s workspace attachments. To avoid guessing which arrows they show, the investigation enumerated every legal 3-removal sequence from the actual Level 4 definition. There are exactly two ordered sequences; both produce the same remaining set:

| Successful removals | Remaining arrows | Legal next move |
| --- | --- | --- |
| `a05 → a07 → a08` | `a01, a02, a03, a04, a06, a09, a10` | `a06` only |
| `a07 → a05 → a08` | `a01, a02, a03, a04, a06, a09, a10` | `a06` only |

The exact gameplay simulator confirms that `a06` clears. The remaining routes are `a01` blocked by `a10`, `a02` by `a03`, `a03` by `a04`, `a04` by `a01`, `a09` by `a01`, and `a10` by `a06`. A solver sequence from the seven-arrow state is `a06 → a10 → a01 → a04 → a03 → a09 → a02`.

**Finding:** the reported state is solvable, not a deadlock, and there is no solver/gameplay disagreement. The board has only one safe choice at this point, `a06`; selecting any of the six blocked arrows leaves the arrangement unchanged and correctly costs one heart. The evidence supports a hard-to-spot sole move as the likely source of the “impossible” impression. Without the actual screenshots or tapped-arrow IDs, it cannot establish which two arrows were tapped or whether a specific physical touch missed its intended path. The QA panel can now expose and highlight the safe move using the gameplay simulator.

## Exhaustive reachable-state method

`auditReachableStates` first builds a directed blocker graph by testing every ordered arrow pair with `simulateMove`, the same full-body, sampled collision function used by gameplay and the ordinary solver. With all other arrows stationary, an arrow can leave a state exactly when it can escape each remaining arrow individually; therefore a subset is legal when none of its remaining arrows has a blocker still in that subset. The audit then walks every distinct reachable remaining-arrow subset, records each legal removal edge, and keeps a removal-sequence witness for every deadlock.

This graph method avoids repeating geometric sweep calculations for equivalent subsets while preserving the gameplay rule exactly. The ordinary solver and audit both derive blocker edges from `simulateMove`; the audit checks every reachable state, not just one winning sequence. Since each legal transition removes one arrow, the state graph strictly decreases in size. If every reachable nonterminal state has at least one legal transition and the empty state is reached, every maximal legal removal sequence terminates at the cleared board. Directed blocker cycles and explicit no-move states are reported separately.

The audit is exact and bounded: at most 20 arrows and `2^20` distinct subset states. A larger level is rejected with an explicit error; it is never marked passed after partial enumeration. The current maximum is 16 arrows, so every current state was examined without truncation.

## Current results after the self-geometry correction

| Level | Reachable states | Legal transitions | Completed states | Deadlocks | Dependency cycles |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 — Small Tangle | 16 | 24 | 1 | 0 | 0 |
| 2 — Dense Mini-Maze | 83 | 205 | 1 | 0 | 0 |
| 3 — Nested Paths | 54 | 135 | 1 | 0 | 0 |
| 4 — Interwoven Board | 14 | 16 | 1 | 0 | 0 |
| 5 — Shaped Puzzle | 19 | 32 | 1 | 0 | 0 |
| 6 — Dense Challenge | 350 | 1,159 | 1 | 0 | 0 |
| **Total** | **536** | **1,571** | **6** | **0** | **0** |

The Level 4 seven-arrow sub-board alone has 10 reachable states, 11 legal transitions, one cleared state, no deadlocks, and one initial legal move (`a06`). These values and both legal three-removal orders are regression-tested.

## Self-geometry addendum

At the time of the original self-geometry audit, the catalog contained 59 arrows. Each was validated on its own before level-level overlap, solver, or reachable-state checks. The geometry audit uses the same `moveArrowDistance` route window as animation and checks the full sweep until the arrow is outside the board. Body-to-body clearance is fixed at 0.18 board cells (the canonical widest stroke). To conservatively cover the 0.05-cell movement sample interval, the swept-body bound is 0.23 cells. Arrowhead-to-body checks use the actual maximum-size triangle and its collision stroke: 0.108 cells statically, expanded to 0.158 cells between sweep samples. A connected terminal body segment is excluded from head-self-contact checks; all other segments are checked. Exact contacts within floating-point epsilon fail validation.

The self-audit reproduced the Level 3 symptom. The likely two-arrow state is reachable after `a06 → a07 → a05 → a02 → a04`, leaving `a01` and `a03`, the two longest paths. The pre-correction `a03` centerline did not cross itself while stationary. Its southbound exit head swept into the unretracted horizontal tail section at about half a cell of travel; the ordinary move simulator only tested other arrows and the old validator did not test the arrow against itself. The old orientation now fails both `validateArrow` and `simulateMove` with a Level 3 arrowhead self-collision diagnostic. The fixed `a03` keeps the same path geometry and faces out from the other endpoint; in the reconstructed state it is the single legal move and the board still clears.

The same audit found three more invalid exits: Level 4 `a04` and `a06`, and Level 6 `a10`. Level 4 `a04` now has a short final hook that exits south instead of sweeping its tail; Level 4 `a06` and Level 6 `a10` use the opposite orientation on their unchanged centerlines. All four old arrows were tested as invalid before correction. All 59 current arrows pass the full self-motion audit. The Level 4 three-removal reproduction remains unchanged: `a05 → a07 → a08` or `a07 → a05 → a08` leaves the same seven-arrow state, where `a06` is the only safe move and the remaining solver route still completes the board.

The level fingerprints for Levels 3, 4, and 6 were intentionally updated and frozen in the regression test. At that point the revised exact audits covered 536 reachable states and 1,571 legal transitions, with no deadlocks or cycles. Current Round 8 totals are recorded in the update below.

## QA-only state inspection

In development and explicit QA builds, a two-second hold on the level label opens diagnostics for remaining arrow IDs, actual legal-move count, solver route, current solvability, selected-arrow blocker and collision distance. **Highlight one legal arrow** applies a temporary visual marker to an arrow found clear by `simulateMove`. QA level jumps/restarts are temporary runs; inspecting, highlighting, and reset controls do not deduct hearts or write progress. Production builds do not include the QA panel chunk.

## Validation command

The catalog validator runs this exact audit as part of `npm test`, alongside frozen content fingerprints, path separation, the normal solver, and replay of solver sequences through the gameplay simulator. Catalog checks no longer run synchronously during app startup; deployment is gated by the test workflow instead.

## Round 8 catalog update

Round 8 retains the Level 4 definition and its reconstruction above. No Level 4 path was changed: all 14 reachable states and 16 legal transitions still pass, including the seven-arrow state whose only legal move is `a06`. A local portrait browser preview confirmed the board fits at 390×844 CSS pixels; no physical iPhone was available to reproduce the reported playtest tap sequence.

Level 5 was the only puzzle re-authored. Its 12×14 canopy-and-hooked-trunk shape now has 8 arrows (up from 7), including fuller side branches and a short winding route near the canopy. The sampled area farther than 1.5 board units from a path fell from 35.4% to 18.75%; centerline occupancy rose from 0.401 to 0.577. It retains four initially removable arrows and dependency depth 3. The updated puzzle has 38 reachable states, 83 legal transitions, one cleared terminal state, no deadlocks, and no dependency cycles.

The Level 5 content fingerprint is `bb8c27c5324732870afb48a48c9568a60af3df9b5c624fd0b3665162c38947ff`. Level 6 remains frozen at its previous fingerprint `0a86c43f5843b91b47f706155502f487819e3f173c118674ab5aa25e905c0d8e`. The Round 8 catalog contains 60 individually validated arrows and exactly audits 555 reachable states with 1,622 legal transitions across all six levels; none deadlock or form dependency cycles.
