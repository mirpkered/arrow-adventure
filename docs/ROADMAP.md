# Arrow Adventure Redesign Roadmap

This roadmap tracks the reset prototype on `redesign/shared-board-prototype`. The prior 40-level catalog, generation system, and save migration were intentionally removed from this branch. Feature candidates deploy to independent QA only; production remains on `main` and has not been modified by this round.

## Current QA prototype

- Six fixed, solver-verified shared-board puzzles, Levels 1–6.
- Replacement geometry reviewed against the three user-supplied visual references: a small tangle, dense mini-maze, nested paths, broad interwoven board, canopy-and-trunk shaped puzzle, and dense challenge.
- Half-cell coordinate placement for close route packing; cardinal and diagonal one-unit segments remain supported.
- Repeated route interleaving, meaningful escape blockers and varied arrow counts, path lengths and turns. Exact definitions are fingerprinted in the test suite.
- Full-screen safe-area-aware mobile layout, single-tap path selection, and continuous path-following animation at 2× default speed.
- Thin, Medium and Bold line presets; the 0.18-cell collision model remains fixed across visual settings.
- Three hearts, restart and temporary in-session progression. No save or old-save migration.
- QA-only two-second HUD long press with speed, stroke, diagnostics, level navigation and candidate SHA. Production builds omit this feature.
- Approved logo, icons, PWA metadata and independent QA Pages deployment remain in place.

## Review gates

1. Play the six QA boards and review readability, directional clarity, path-body motion, close-path hit testing, blocked first taps and difficulty.
2. Perform physical iPhone Safari testing for touch behavior, safe areas and frame pacing. It was not available during the current implementation round.
3. Keep catalog validation, frozen fingerprints, solver/gameplay agreement, typecheck and both production/QA-base builds passing.
4. Keep all redesign work off production until gameplay and content are explicitly approved.

The local geometry contact sheet is [round-4-levels.png](previews/round-4-levels.png). It shows board geometry only and is not a browser/device capture. QA host and release flow are in [QA_ENVIRONMENT.md](QA_ENVIRONMENT.md).

## Later work after review

- Refine the six boards using user playtest feedback; preserve the current IDs and update fingerprints deliberately when a layout is approved to change.
- Add more curated levels only when they add a useful teaching or decision pattern.
- Design future mechanics—black holes, switches, directional gates and portals—with explicit movement, collision and solver rules before implementation.
- Reconsider tutorial, persistent progression and Free Play after the foundational geometry has been reviewed.
