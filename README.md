# Arrow Adventure

Arrow Adventure is a mobile-first, browser-based puzzle game by Mirpworks. Each level packs winding arrows onto a small grid. Tap arrows that have a clear route to the right edge and clear the board without spending all three hearts.

**Play:** [mirpkered.github.io/arrow-adventure](https://mirpkered.github.io/arrow-adventure/)

## Controls and rules

- Tap or click an arrow to send it off the board. Keyboard users can focus an arrow and press Enter or Space.
- An arrow moves as a connected body along its existing winding line, then continues forward through its arrowhead until every segment clears the edge.
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
- `src/game/catalog.ts` and `src/game/catalog/adventure-v1.json` — stable curated level identities, metadata, frozen puzzle definitions, cross-reference checks, deterministic reproduction, and solver validation.
- `src/game/levels.ts` — version-1 prototype generator retained for reproducibility and compatibility regression checks.
- `src/game/rules.ts` — path validation, full-frame move simulation, exit collision checks, and depth-first solvability solver.
- `src/game/session.ts` — fresh run and heart-loss rules.
- `src/game/progress.ts` — schema-v2 ID-based progress, selection persistence, and non-destructive migration from the numeric v1 save.
- `src/main.ts` — SVG interface, touch/keyboard input, animation, and progression flow.
- `src/style.css` — responsive visual style and mobile layout.
- `tests/game.test.ts` — rule, catalog integrity, frozen-layout compatibility, migration, progression, and persistence tests.

## Long-term direction

The current release is a ten-level prototype. The planned split between curated Adventure Mode and generated Free Play, provisional chapter progression, future mechanics, and level review process are documented in:

- [Roadmap](docs/ROADMAP.md)
- [Game design and engine direction](docs/GAME_DESIGN.md)
- [Adventure level authoring](docs/LEVEL_AUTHORING.md)

## Puzzle generation and collision rules

The first ten Adventure levels are frozen catalog definitions with stable numeric seeds and generator version metadata. Adventure loads these snapshots instead of generating a new layout at runtime. Their stable IDs are `first-flight-001` through `first-flight-010`; their displayed numbers and progression sequences are catalog fields, not array-position identities. Each arrow is an orthogonal path of cell centers, stored tail-to-head. All segments must stay in bounds, be connected by single horizontal or vertical steps, avoid self-crossing, and end facing east. Arrows may not share any occupied cell.

The original generator packs a 3-by-3 serpentine path into each tile. Its implementation is retained as generator `tile-serpentine` version 1, with seeds recorded beside each snapshot. Arrows in a row block east-facing exits to their left, producing removal dependencies. Catalog validation reproduces generated records from their provenance and runs the solver; an invalid or unsolved catalog entry fails validation.

For each attempted move, the rule engine advances the connected body one cell at a time, appending a new head cell eastward and releasing the tail cell. At every frame it checks every occupied body cell against all stationary arrows. The move is committed only if the entire body exits the board. A blocked simulation does not alter the board.

## Progress compatibility

New saves use schema v2 at `mirpworks.arrow-adventure.save.v2` and store stable IDs for completed levels, the highest unlocked level, and the selected level. On first load, the numeric v1 record at `mirpworks.arrow-adventure.save.v1` is translated through a fixed number-to-ID migration table. The old key is kept as a recovery source. Since v1 did not persist selection, migration selects the highest unlocked level. Completion remains attached to the stable ID across content-version updates.

## Current prototype limitations

- The first ten levels use one path motif and arrows that exit east; visual and directional variety is intentionally limited. Their exact puzzle snapshots and generator provenance are recorded in the curated catalog.
- Catalog solvability checks cover the current standard-arrow rules. Future state-changing mechanics will need corresponding solver-state support before levels using them can be validated.
- Saves are local to one browser and device and can be cleared with browser storage.
- Browser layout and input are designed for touch and tested with automated rule/build checks; physical iPhone testing remains a follow-up.
