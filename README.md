# Arrow Adventure

Arrow Adventure is a mobile-first, browser-based puzzle game by Mirpworks. Each level packs winding arrows onto a small grid. Tap arrows that have a clear route out of the board and clear the board without spending all three hearts. Adventure Mode currently contains 40 curated levels.

**Play:** [mirpkered.github.io/arrow-adventure](https://mirpkered.github.io/arrow-adventure/)

The approved title artwork is shown on the welcome screen. The untouched master image is `public/branding/arrow-adventure-official-logo.png`; proportional PNG derivatives for the favicon, Apple touch icon, and install icons are in `public/icons/`. The web app manifest is `public/site.webmanifest`. Icon derivatives preserve the full square composition and use resizing only.

## Controls and rules

- Tap or click an arrow to send it off the board. Keyboard users can focus an arrow and press Enter or Space.
- An arrow moves as a connected body along its winding line, then continues in its final heading until every segment clears the board. Paths and exits can use all eight compass directions.
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
- `src/game/geometry.ts` — shared path, line-stroke, and arrowhead geometry used by level validation, move simulation, and the solver.
- `src/game/tutorials.ts` — one-time local tutorial acknowledgement, independent from save schema v2.
- `src/game/session.ts` — fresh run and heart-loss rules.
- `src/game/progress.ts` — schema-v2 ID-based progress, selection persistence, and non-destructive migration from the numeric v1 save.
- `src/main.ts` — SVG interface, touch/keyboard input, animation, and progression flow.
- `src/style.css` — responsive visual style and mobile layout.
- `tests/game.test.ts` — movement geometry, solver, catalog integrity, frozen-layout compatibility, migration, progression, tutorial, and persistence tests.
- `public/branding/` — approved source logo artwork.
- `public/icons/` and `public/site.webmanifest` — generated browser and install icons plus PWA metadata.

## Long-term direction

The planned split between curated Adventure Mode and generated Free Play, provisional chapter progression, future mechanics, and level review process are documented in:

- [Roadmap](docs/ROADMAP.md)
- [Game design and engine direction](docs/GAME_DESIGN.md)
- [Adventure level authoring](docs/LEVEL_AUTHORING.md)

## Puzzle generation and collision rules

Adventure loads frozen catalog snapshots instead of generating layouts at runtime. Levels 1–10 retain stable IDs `first-flight-001` through `first-flight-010`, their original seeds, generator version, and puzzle fingerprints. Levels 11–40 are curated authored definitions with content version 1. Display numbers and progression sequences are catalog fields, not array-position identities. Each arrow is an 8-connected path of grid points stored tail-to-head. Segments stay in bounds, avoid self-crossing, and may end facing in any of eight compass directions.

The original generator packs a 3-by-3 serpentine path into each tile and remains available as generator `tile-serpentine` version 1. Levels 11–20 were selected as fixed catalog content for cardinal direction and dependency variety. Levels 21–40 are frozen diagonal candidates selected against progression constraints for eight-way exits, mixed segment directions, winding paths, opening choices, and solvability. Their final definitions are stored directly in the catalog. Catalog validation rejects self-crossing routes and visible arrow overlap, then runs the same move simulator used by gameplay; an invalid or unsolved entry fails validation.

For each attempted move, the rule engine advances the connected body one path step at a time, then appends new head points in the final heading while releasing the tail. At every frame it compares the full stroked body polylines and triangular arrowheads against every stationary arrow. Centerline distance at or below the rendered body stroke width (0.46 board units), with a 1e-8 numerical tolerance, counts as collision. Segment distance detects diagonal crossings between grid points and endpoint contact. The move succeeds only after the complete body is outside the board. A blocked simulation does not alter the board. The solver calls this same simulation for each candidate removal.

Level 21 introduces the diagonal tutorial. It explains diagonal travel, edge routes, and line crossings; dismissal is remembered under a tutorial-specific local-storage key without changing save schema v2.

## Progress compatibility

New saves use schema v2 at `mirpworks.arrow-adventure.save.v2` and store stable IDs for completed levels, the highest unlocked level, and the selected level. On first load, the numeric v1 record at `mirpworks.arrow-adventure.save.v1` is translated through a fixed number-to-ID migration table. The old key is kept as a recovery source. Since v1 did not persist selection, migration selects the highest unlocked level. Completion remains attached to the stable ID across content-version updates.

## Current prototype limitations

- The first ten frozen puzzles retain their original east-facing motif. Levels 11–20 add cardinal exits and Levels 21–40 add diagonal geometry. All expanded levels need human playtesting for difficulty and readability.
- Catalog solvability checks cover the current standard and diagonal arrow rules. Future state-changing mechanics will need corresponding solver-state support before levels using them can be validated.
- Saves are local to one browser and device and can be cleared with browser storage.
- Browser layout and input are designed for touch. Physical iPhone Safari testing remains a follow-up; automated unit checks do not replace device testing.
