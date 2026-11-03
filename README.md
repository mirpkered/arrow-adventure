# Arrow Adventure

Arrow Adventure is a mobile-first, browser-based puzzle game by Mirpworks. Each level packs winding arrows onto a small grid. Tap arrows that have a clear route out of the board and clear the board without spending all three hearts. Adventure Mode currently contains 20 curated levels.

**Play:** [mirpkered.github.io/arrow-adventure](https://mirpkered.github.io/arrow-adventure/)

## Controls and rules

- Tap or click an arrow to send it off the board. Keyboard users can focus an arrow and press Enter or Space.
- An arrow moves as a connected body along its existing winding line, then continues in its final facing direction until every segment clears the board. Arrows can exit up, down, left, or right.
- The whole motion is simulated before it begins. If any segment meets another arrow, the move fails and costs one heart; the arrow stays where it was.
- Each level starts with three hearts. Losing all three requires a restart. There is no timer, undo, advertising, reward currency, or power-up.
- Use the restart button to reset a level, or tap its number to replay any unlocked level.
- Completed levels and the highest unlocked level are saved in browser local storage.

## Local development

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The production app is built with:

```sh
npm test
npm run typecheck
npm run build
```

## Deployment

GitHub Actions runs tests, TypeScript checking, and the Vite production build on pushes to `main`, then publishes the `dist/` folder to GitHub Pages. The Pages site must use the `GitHub Actions` build and deployment source in repository settings.

Vite's base path is `/arrow-adventure/`, matching the project page URL. The workflow checks this source on every deployment.

## Project layout

- `src/game/types.ts` — level, arrow, move result, and save types.
- `src/game/catalog.ts` and `src/game/catalog/adventure-v*.json` — stable curated level identities, metadata, frozen puzzle definitions, cross-reference checks, deterministic reproduction, and solver validation.
- `src/game/levels.ts` — version-1 prototype generator retained for reproducibility and compatibility regression checks.
- `src/game/rules.ts` — path validation, full-frame move simulation, exit collision checks, and depth-first solvability solver.
- `src/game/session.ts` — fresh run and heart-loss rules.
- `src/game/progress.ts` — schema-v2 ID-based progress, selection persistence, and non-destructive migration from the numeric v1 save.
- `src/main.ts` — SVG interface, touch/keyboard input, animation, and progression flow.
- `src/style.css` — responsive visual style and mobile layout.
- `tests/game.test.ts` — rule, catalog integrity, frozen-layout compatibility, migration, progression, and persistence tests.

## Long-term direction

The planned split between curated Adventure Mode and generated Free Play, provisional chapter progression, future mechanics, and level review process are documented in:

- [Roadmap](docs/ROADMAP.md)
- [Game design and engine direction](docs/GAME_DESIGN.md)
- [Adventure level authoring](docs/LEVEL_AUTHORING.md)

## Puzzle generation and collision rules

Adventure loads frozen catalog snapshots instead of generating layouts at runtime. Levels 1–10 retain stable IDs `first-flight-001` through `first-flight-010`, their original seeds, generator version, and puzzle fingerprints. Levels 11–20 are curated authored definitions with content version 1. Display numbers and progression sequences are catalog fields, not array-position identities. Each arrow is an orthogonal path of cells stored tail-to-head. Segments stay in bounds, connect by single horizontal or vertical steps, avoid self-crossing, and may end facing in any cardinal direction. Arrows may not share occupied cells.

The original generator packs a 3-by-3 serpentine path into each tile and remains available as generator `tile-serpentine` version 1. Levels 11–20 were selected as fixed catalog content: the first four were hand-authored for directional teaching and dependency patterns; six later boards were selected from a deterministic candidate search for mixed exits, path-length variation, turn variety, and constrained safe moves. Their final definitions are stored directly in the catalog. Catalog validation checks each path and runs the same move simulator used by gameplay; an invalid or unsolved entry fails validation.

For each attempted move, the rule engine advances the connected body one cell at a time along its ordered path, then appends new head cells in the final cardinal direction while releasing the tail. At every frame it checks every occupied body cell against all stationary arrows. The move succeeds only after the complete body is outside the board. A blocked simulation does not alter the board. The solver calls this same simulation for each candidate removal, avoiding a separate set of movement rules.

## Progress compatibility

New saves use schema v2 at `mirpworks.arrow-adventure.save.v2` and store stable IDs for completed levels, the highest unlocked level, and the selected level. On first load, the numeric v1 record at `mirpworks.arrow-adventure.save.v1` is translated through a fixed number-to-ID migration table. The old key is kept as a recovery source. Since v1 did not persist selection, migration selects the highest unlocked level. Completion remains attached to the stable ID across content-version updates.

## Current prototype limitations

- The first ten frozen puzzles retain their original east-facing motif. Levels 11–20 add mixed cardinal exits and more path shapes, but the catalog is still small and needs playtesting for difficulty, visual clarity, and variety.
- Catalog solvability checks cover the current standard-arrow rules. Future state-changing mechanics will need corresponding solver-state support before levels using them can be validated.
- Saves are local to one browser and device and can be cleared with browser storage.
- Browser layout and input are designed for touch. Physical iPhone Safari testing remains a follow-up; automated unit checks do not replace device testing.
