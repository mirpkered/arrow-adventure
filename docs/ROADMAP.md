# Arrow Adventure Roadmap

This roadmap describes the reset, shared-board game now targeted for production. The original 40-level game, progress records, and old puzzle system are retired; they are not imported.

## Current release foundation

- Six fixed, solver-verified puzzles: Small Tangle, Dense Mini-Maze, Nested Paths, Interwoven Board, Shaped Puzzle, and Dense Challenge.
- Board-wide path composition with half-cell placement, close parallel routes, nested bends, varied path lengths, cardinal and diagonal segments, and meaningful exit dependencies.
- Full-viewport mobile interface with title, gameplay, pause, settings and credits screens; safe-area handling, fit-to-board scaling, pinch zoom, pan and view reset.
- Static full-screen portrait title scene with a locally stored purple mountain landscape, warm sunrise, and winding cyan trail; the approved square app icon remains unchanged.
- Continuous distance-based arrow animation. A blocked arrow travels to its deterministic collision point, turns red, reverses faster and remains red until it is removed. Each attempt costs one heart.
- Three-heart system, restart, level progression and device-local stable-state saving.
- Light, Dark and Automatic appearance; independent optional synthesized music and sound effects.
- Light is the first-launch default unless a valid saved preference exists; Automatic follows the device without restarting the current puzzle.
- Exact, memoized reachable-state solvability audit of all six boards (555 reachable states, 1,622 legal transitions), plus full self-motion geometry validation of all 60 arrows; details are in [SOLVABILITY_AUDIT.md](SOLVABILITY_AUDIT.md).
- QA-only state diagnostics display remaining IDs, legal moves, solver path and selected-arrow collision; the panel can highlight a legal move without mutating gameplay or saves.
- One-time Mirpworks splash adapted from Word Search Adventure.
- QA and production have separate Pages sites, candidate commits and local-storage namespaces. Production `main` is directly authorized for this release; experimental future changes can still be evaluated independently in QA.

## Validation and playtest gates

1. Keep catalog integrity, frozen level fingerprints, collision/solver agreement, save validation, input, viewport and splash tests passing.
2. Run tests, TypeScript validation, the production build, and a QA-base build for every release candidate.
3. Physically test iPhone Safari touch selection, pinch/pan, safe areas, reduced motion, splash lifecycle, audio behavior and frame pacing before public announcement. Physical device testing was not performed in the current work session.
4. Preserve a recoverable production checkpoint before broad future content or architecture changes.

## Next recommended work

- Play all six refined puzzles on a physical iPhone and tune board scale, touch precision, speed, blocked collision feel, and level difficulty. Physical device testing was not performed for Round 8.
- Playtest all six levels on a physical iPhone and tune board scale, touch precision, speed, blocked collision feel, and level difficulty.
- Refine or replace individual puzzles based on observed solves; update their frozen fingerprints deliberately and re-run the solver and geometry review.
- Add a modest next batch of curated puzzles only after the current collection is reviewed.
- Add tutorials or level selection after playtesting establishes onboarding needs.
- Design future black holes, switches, directional gates, portals, and Free Play as separate, reviewed mechanics. Do not add them until their movement, collision, solver, save, and tutorial rules are specified.
