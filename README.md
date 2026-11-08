# Arrow Adventure — shared-board prototype

This redesign replaces the previous 40-level set with six prototype puzzles. Every level places winding arrow paths together on one board. Arrows share exit lanes, so the player must find a safe removal order. The game opens directly into a full-viewport play screen; the approved logo remains available for PWA installation and app icons rather than as a large title banner.

The approved logo and PWA icons remain in `public/branding/` and `public/icons/`. The Vite base path and GitHub Pages workflow are unchanged. This redesign is being developed on `redesign/shared-board-prototype`; it has not been merged or deployed to the production Pages site.

An independent QA environment is available at [mirpkered.github.io/arrow-adventure-qa](https://mirpkered.github.io/arrow-adventure-qa/). It deploys only a manually selected source commit after tests, typecheck, and a QA-base production build. See [QA environment and release procedures](docs/QA_ENVIRONMENT.md).

## Play the redesign locally

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open the local Vite URL. Start at Level 1 and clear each board to advance through this session's six puzzles. Restart restores the current level and its three hearts. Refreshing or reopening starts at Level 1. The game does not read or write local storage, so save data from earlier releases is ignored. In development and QA builds, hold the compact level label for two seconds (or focus it and press Enter/Space) to open temporary QA settings.

## Controls and rules

- Tap or click an arrow to send it out; keyboard users can focus an arrow and press Enter or Space.
- The arrow body follows its stored winding path as the head moves onward along its final heading. Cardinal and diagonal path segments are supported. Movement defaults to twice the previous animation speed; the QA panel can tune speed and body stroke width (0.12, 0.15, or 0.18 board cells).
- Collision is checked against the complete moving body and arrowhead. The solver samples the swept route every 0.05 board cells and adds that interval as a conservative collision margin. A blocked selection costs one heart and leaves the board geometry unchanged.
- Each level starts with three hearts. Losing all three requires a restart. There is no undo or timer.
- There is no level selection or automatic progress saving in this prototype.
- QA-only diagnostics can show arrow IDs, path ownership, touch hit regions, and board geometry; these controls are gated by a build-time flag and excluded from production builds.

## Development checks

```sh
npm test
npm run typecheck
npm run build
```

Catalog validation runs at import and in tests. It rejects malformed or overlapping arrow paths, layouts below the authored proximity/interleaving threshold, and any puzzle without a solver-found solution. Gameplay and solver use the same movement simulator and collision geometry.

## Architecture

- `src/game/catalog.ts` — six authored puzzle definitions, minimal progression metadata, and structural/solvability validation.
- `src/game/types.ts` — board, arrow, curated entry, and move result types.
- `src/game/geometry.ts` — continuous segment-distance checks and visible arrowhead/body collision geometry.
- `src/game/rules.ts` — path validation, distance-based body movement, conservative swept collision simulation, solver, and curation metrics.
- `src/game/session.ts` — in-memory session progression, run creation, restart, and hearts.
- `src/main.ts` — full-screen SVG interaction, single delegated pointer hit-testing, requestAnimationFrame animation, and session progression.
- `src/qa/qaPanel.ts` — QA-build-only long-press settings and diagnostics; production builds do not include this dynamic chunk.
- `tests/game.test.ts` — catalog integrity, solvability, geometry, movement, hearts, restart, and nonpersistent session tests.
- `public/branding/` and `public/icons/` — approved master logo and full-composition icon derivatives.

## Prototype limitations

- The current six puzzles are unchanged in this round. Their solver and geometry-metric checks do not establish the visual density requested for the new layouts; replacement remains pending the three user-supplied reference screenshots.
- Physical iPhone Safari frame pacing and touch behavior have not been re-tested in this implementation round.
- Progress intentionally resets on a fresh visit and there is no level picker.
- Black holes, switches, gates, portals, tutorials, undo, timers, Free Play, and persistence are out of scope.
