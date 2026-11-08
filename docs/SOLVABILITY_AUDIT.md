# Solvability audit — Round 6

## Production baseline and Level 4 finding

The audited production baseline was commit `fea155816c19d9a03ea30f2a0235562ee280a27f`. Level 4 is stable catalog entry `shared-board-004` (“Interwoven Board”), board 14×12 with 10 arrows. Its frozen puzzle SHA-256 is `f620176b5b5710bfe7175e7f49cbd3646b096fdc7872c73f217318d0fbeab675` (asserted in `tests/game.test.ts`). No geometry or collision change was needed.

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

## Current results

| Level | Reachable states | Legal transitions | Completed states | Deadlocks | Dependency cycles |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 — Small Tangle | 16 | 24 | 1 | 0 | 0 |
| 2 — Dense Mini-Maze | 83 | 205 | 1 | 0 | 0 |
| 3 — Nested Paths | 30 | 59 | 1 | 0 | 0 |
| 4 — Interwoven Board | 14 | 16 | 1 | 0 | 0 |
| 5 — Shaped Puzzle | 19 | 32 | 1 | 0 | 0 |
| 6 — Dense Challenge | 680 | 2,612 | 1 | 0 | 0 |
| **Total** | **842** | **2,948** | **6** | **0** | **0** |

The Level 4 seven-arrow sub-board alone has 10 reachable states, 11 legal transitions, one cleared state, no deadlocks, and one initial legal move (`a06`). These values and both legal three-removal orders are regression-tested.

## QA-only state inspection

In development and explicit QA builds, a two-second hold on the level label opens diagnostics for remaining arrow IDs, actual legal-move count, solver route, current solvability, selected-arrow blocker and collision distance. **Highlight one legal arrow** applies a temporary visual marker to an arrow found clear by `simulateMove`. QA level jumps/restarts are temporary runs; inspecting, highlighting, and reset controls do not deduct hearts or write progress. Production builds do not include the QA panel chunk.

## Validation command

The catalog validator runs this exact audit as part of `npm test`, alongside frozen content fingerprints, path separation, the normal solver, and replay of solver sequences through the gameplay simulator. Catalog checks no longer run synchronously during app startup; deployment is gated by the test workflow instead.
