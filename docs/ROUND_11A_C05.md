# Round 11A — Level 3 c05 Head/Tail Approach

## Status

This is a targeted correction to the Round 11 compactness candidate. It changes only the orientation of arrow `c05` in Level 3 — Winding Paths. The 7×7 true grid, ten arrows, centerline corridors, route lengths, stroke/head/tail styling, and movement implementation are unchanged. Level 3 content version advances from 2 to 3; other level content versions remain 2. Production remains on its approved Round 10 revision.

## Reproduction and findings

The Round 11 baseline at `e9b3cdde7faf37589f4af98331e73c1048c22a30` contains the reported route, ordered from tail to head:

```text
(7,4) → (6,4) → (5,4) → (5,3) → (6,3) → (6,2) → (7,2) → (7,3)
```

Its head exits south, directly toward the original tail marker at `(7,4)`. After `c09` is removed, c05 can escape. The exact runtime movement function was sampled throughout that full escape. The centerline, moving body, and head do not intersect or violate the existing swept self-clearance checks. Therefore an actual self-collision was **not reproduced**. The cause was visual: while the tail retracts left along `y=4`, the southbound head returns toward the tail's just-vacated position. At travel `0.285` cells the conservative rendered head-tip-to-tail-marker surface gap reaches `0.2866` cells. This close opposing motion made the arrow appear to run over itself.

The collision rules correctly accepted the old geometry; increasing collision tolerance or changing the validator would have been an unjustified workaround. The animation updates the tail, body polyline, and arrowhead from the same distance-interpolated frame, so this was not a stale-frame or rendering-timing defect.

## Correction and gameplay effect

The revised path is the exact reverse of the previous ordered path:

```text
(7,3) → (7,2) → (6,2) → (6,3) → (5,3) → (5,4) → (6,4) → (7,4)
```

The same seven unit segments occupy the same corridors. The head now exits east, away from the nearby original tail region. Maximum-head-width sampling puts its minimum head-to-tail-marker surface clearance at `0.6854` cells. No gameplay engine or collision rule changed.

The orientation necessarily changes one dependency: c05 is now a safe opening move instead of being blocked by c09. Level 3 has four initial legal arrows instead of three; it retains dependency depth 5. Its exhaustive state space changes from 70 states / 165 transitions to 84 / 212. Every reachable state remains completable, with one terminal state and no deadlocks or dependency cycles. The complete level retains its 7×7 grid, ten arrows, 54 route units, nine interleaved pairs, 147 close segment contacts, and 94.4% adjacent-path coverage.

With Levels 1, 2, 4, and 5 unchanged, the current five-level catalog totals 235 reachable states and 517 legal-removal transitions across its exact audits. All 50 arrows pass individual geometry validation and all five level audits have zero deadlocks and dependency cycles.

## Regression and save compatibility

`tests/round11a-c05.test.ts` freezes the reported pre-fix route, demonstrates the head's approach to its own tail location, checks body and head separation throughout movement samples, measures the rendered arrowhead/tail-marker gap, verifies retraction past a route vertex, and replays c05 and a complete Level 3 solution through the real simulator. The test also checks the complete reachable-state audit.

Level 3's catalog `contentVersion` advances from 2 to 3. A v4 save with an incomplete Level 3 board at version 2 is restarted with the new full arrow set, three hearts, and no red marks. Completed-level credit and unrelated appearance/audio settings remain intact. In-progress saves for Levels 1, 2, 4, and 5 keep their existing content versions and are not reset.

## Visual evidence

The motion-frame PNG uses frames sampled from `moveArrowDistance`; the dashed amber circle marks the original tail coordinate from the reported orientation. These are engine-geometry previews, not browser screenshots.

- [Level 3 before/after in full puzzle context](previews/round-11a/level-3-before-after-c05.png)
- [c05 head/tail diagnostic](previews/round-11a/c05-head-tail-diagnostic.png)
- [c05 sampled movement frames](previews/round-11a/c05-engine-movement-frames.png)
- [Updated 390×844 Level 3 view](previews/round-11a/level-3-iphone-390x844.png)
- [Updated full Level 3 board](previews/round-11a/level-3-full.png)

Physical iPhone retesting of the corrected orientation remains required. Round 11A is isolated to the `round-11/compactness-refinement` branch and QA deployment; the temporary production synchronizer monitors only `round-10/five-level-foundation`.
