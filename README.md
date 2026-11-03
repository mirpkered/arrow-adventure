# Arrow Adventure — shared-board prototype

This redesign replaces the previous 40-level set with six newly authored prototype puzzles. Every level places winding arrow paths together on one board. Arrows share exit lanes, so the player must find a safe removal order.

The approved logo and PWA icons remain in `public/branding/` and `public/icons/`. The Vite base path and GitHub Pages workflow are unchanged. This redesign is being developed on `redesign/shared-board-prototype`; it has not been merged or deployed to the production Pages site.

## Play the redesign locally

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open the local Vite URL. Start at Level 1 and clear each board to advance through this session's six puzzles. Restart restores the current level and its three hearts. Refreshing or reopening starts at Level 1. The game does not read or write local storage, so save data from earlier releases is ignored.

## Controls and rules

- Tap or click an arrow to send it out; keyboard users can focus an arrow and press Enter or Space.
- The arrow body follows its stored winding path as the head moves onward along its final heading. Cardinal and diagonal path segments are supported.
- Collision is checked against the complete visible line and arrowhead at each movement substep. A blocked selection costs one heart and leaves the board geometry unchanged.
- Each level starts with three hearts. Losing all three requires a restart. There is no undo or timer.
- There is no level selection or automatic progress saving in this prototype.

## Development checks

```sh
npm test
npm run typecheck
npm run build
```

Catalog validation runs at import and in tests. It rejects malformed or overlapping arrow paths and any puzzle without a solver-found solution. Gameplay and solver use the same movement simulator and collision geometry.

## Architecture

- `src/game/catalog.ts` — six authored puzzle definitions, minimal progression metadata, and structural/solvability validation.
- `src/game/types.ts` — board, arrow, curated entry, and move result types.
- `src/game/geometry.ts` — continuous segment-distance checks and visible arrowhead/body collision geometry.
- `src/game/rules.ts` — path validation, interpolated body movement, collision simulation, and solver.
- `src/game/session.ts` — in-memory session progression, run creation, restart, and hearts.
- `src/main.ts` — SVG interaction, animation frames, and session progression.
- `tests/game.test.ts` — catalog integrity, solvability, geometry, movement, hearts, restart, and nonpersistent session tests.
- `public/branding/` and `public/icons/` — approved master logo and full-composition icon derivatives.

## Prototype limitations

- The six new puzzles have automated solver verification but still need human playtesting for difficulty, clarity, and mobile touch accuracy.
- Movement is represented by four interpolated geometry samples per grid step; this is a lightweight discrete simulation and may need refinement after playtesting.
- Progress intentionally resets on a fresh visit and there is no level picker.
- Black holes, switches, gates, portals, tutorials, undo, timers, Free Play, and persistence are out of scope.
