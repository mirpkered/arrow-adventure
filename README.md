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
- `src/game/levels.ts` — deterministic level construction and generation-time validation.
- `src/game/rules.ts` — path validation, full-frame move simulation, exit collision checks, and depth-first solvability solver.
- `src/game/session.ts` — fresh run and heart-loss rules.
- `src/game/progress.ts` — defensive local storage loading and level unlocks.
- `src/main.ts` — SVG interface, touch/keyboard input, animation, and progression flow.
- `src/style.css` — responsive visual style and mobile layout.
- `tests/game.test.ts` — rule, progression, persistence, and generated-level tests.

## Puzzle generation and collision rules

The ten release levels are deterministic definitions with stable numeric seeds. Each arrow is an orthogonal path of cell centers, stored tail-to-head. All segments must stay in bounds, be connected by single horizontal or vertical steps, avoid self-crossing, and end facing east. Arrows may not share any occupied cell.

The initial generator packs a 3-by-3 serpentine path into each tile. Arrows in a row block the east-facing exits of arrows to their left, so they create a clear removal dependency. The solver explores available moves and tests each full exit against every other arrow; a level is rejected if no complete removal order exists. This gives the first release ten reproducible, guaranteed-solvable puzzles while keeping each path and collision rule unambiguous.

For each attempted move, the rule engine advances the connected body one cell at a time, appending a new head cell eastward and releasing the tail cell. At every frame it checks every occupied body cell against all stationary arrows. The move is committed only if the entire body exits the board. A blocked simulation does not alter the board.

## Current prototype limitations

- The first ten levels use one path motif and arrows that exit east; visual and directional variety is intentionally limited.
- The levels are authored by a deterministic tiled generator rather than an open-ended random puzzle generator. The solver and validation rules are ready to guard future generated boards.
- Saves are local to one browser and device and can be cleared with browser storage.
- Browser layout and input are designed for touch and tested with automated rule/build checks; physical iPhone testing remains a follow-up.
