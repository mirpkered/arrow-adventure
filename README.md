# Arrow Adventure

Arrow Adventure is a mobile-first, advertisement-free puzzle game from Mirpworks. Clear each board by selecting winding arrows in an order that lets their heads follow their paths and their bodies trail behind. The `round-9/adventure-rebuild` branch holds a ten-level Adventure catalog candidate, eight A–H QA review boards, and three separate square-weave experiments. These prototypes do not change the active Adventure catalog.

Production: <https://mirpkered.github.io/arrow-adventure/>

Independent QA: <https://mirpkered.github.io/arrow-adventure-qa/>

## Play

The Mirpworks startup splash leads to the title menu. Choose **Play** to begin at Level 1, or **Continue** to restore the last stable board state. The game saves progress and settings locally on this device. Existing saves from the former release use different keys and are ignored.

Tap an arrow to try to clear it. It follows its winding route, then travels in its final heading until its whole body exits. If blocked, the arrow moves to the collision point, turns red, and returns along its path; it stays red until successfully cleared. Each failed attempt costs one of three hearts, including a repeat attempt on a red arrow. Restart resets the level and hearts. There is no undo, timer, advertising, or monetization.

The board fits the available viewport, supports pinch zoom and panning, and has a reset-view control. Touch hit tolerance is independent of visible line thickness. Light is the default on first launch; saved Light, Dark, or Automatic preferences are respected. The interface follows device appearance when Automatic is selected, respects safe areas, and shortens motion for reduced-motion preferences.

## Menus and settings

The full-screen title scene uses an original static portrait landscape at `public/branding/arrow-adventure-title-scene.svg`; the approved square logo remains unchanged for icons and credits. It presents Play, Continue, Settings, and Credits, with the correct Mirpworks spelling. The in-game menu offers resume, restart, settings, and return to title. Settings save Light/Dark/Automatic appearance, optional background music, and independently optional sound effects. Background music is a quiet synthesized original loop; it is off by default. The game does not pause or replace music from Apple Music, Spotify, or other services.

## Local development and validation

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

To build the QA deployment locally:

```powershell
$env:VITE_BASE_PATH='/arrow-adventure-qa/'
$env:VITE_QA_MODE='true'
$env:VITE_CANDIDATE_SHA='local-preview'
npm run build
```

The QA panel is available only in development or builds with `VITE_QA_MODE=true`. Hold the level label for two seconds (or use Enter/Space when focused) to open speed, stroke, diagnostics, level navigation, restart, reset, and Prototype Review controls. In a QA build, **Prototype Review** offers A–H. D–H are the five Round 9D composition styles: Micro-Arrow Field, Dense Interwoven Maze, Tree Silhouette, Large Mixed-Length Weave, and Framed Composition. Restart from the game HUD, or use the pause menu to choose another prototype or return to the QA board. Review runs use the same gameplay systems but never write Adventure Mode progress. QA and production use separate local-storage namespaces because both Pages sites share the same browser origin.

## Deployment

`main` deploys to production with `/arrow-adventure/` using GitHub Actions. The standalone [`arrow-adventure-qa`](https://github.com/mirpkered/arrow-adventure-qa) repository has a manually dispatched workflow that checks out an explicitly selected source SHA, validates it, builds with `/arrow-adventure-qa/`, and publishes only to the QA Pages repository. Changing QA cannot deploy to production. See [QA environment and release procedures](docs/QA_ENVIRONMENT.md).

## Architecture

- `src/game/catalog.ts` and `src/game/adventure-catalog.json` — ten deterministic Round 9 catalog candidates, stable IDs, footprints, metadata, and integrity checks; not yet approved for release.
- `src/game/prototypes/round9c-prototypes.json`, `round9d-prototypes.json`, `round9e-square-15.json`, `round9f-square-7.json`, and `round9g-square-7-weave.json` — eight Round 9C/D QA review boards plus separate, frozen Round 9E–9G experiments; only the A–H boards are loaded by QA Prototype Review, never by Adventure Mode.
- `src/game/archive/catalog-round8.ts` — non-playable archive of the retired six-level reference set.
- `src/game/geometry.ts`, `src/game/rules.ts`, `src/game/density.ts` — shared board-coordinate transforms, fixed collision envelopes, grid and segment validation, distance-based body movement, solver, and sampled whitespace metrics.
- `src/app/boardGrid.ts` — fine-grid paths rendered in the same SVG coordinate frame as the arrows.
- `src/game/session.ts` — heart and run-state helpers.
- `src/app/viewport.ts` — fitted board view, pinch zoom, pan, and reset.
- `src/app/persistence.ts` — versioned local progress/settings with separate QA and production keys.
- `src/app/audio.ts` — optional synthesized music and original sound effects using Web Audio.
- `src/app/launchSplash.ts` — one-time Mirpworks splash sequence adapted from Word Search Adventure.
- `src/main.ts` — title/menu flow, SVG board, delegated touch handling, rAF movement and save orchestration.
- `src/qa/qaPanel.ts` — development/QA-only testing controls, dynamically imported.

Puzzle geometry and collision assumptions are documented in [Game Design](docs/GAME_DESIGN.md). The exact all-state solvability audit and Level 4 reconstruction are in [Solvability Audit](docs/SOLVABILITY_AUDIT.md). The repeatable process for curated content is in [Level Authoring](docs/LEVEL_AUTHORING.md).

The Round 7A historical baseline and Round 8 Level 5 before/after density measurements are in [Round 7A Density Plan](docs/ROUND_7A_DENSITY_PLAN.md). The first three composition experiments are documented in [Round 9C Prototypes](docs/ROUND_9C_PROTOTYPES.md). The five Round 9D archetypes, exact-state audits, composition metrics, adaptive fit, and preview links are in [Round 9D Design](docs/ROUND_9D_DESIGN.md). The compact 7×7 Round 9F baseline and the Round 9G interwoven refinement, exact reachable-state audits, matched-scale comparison, and preview links are in [Round 9F](docs/ROUND_9F_COMPACT_SQUARE.md) and [Round 9G](docs/ROUND_9G_INTERWOVEN_SQUARE.md).

## Current scope and limitations

- Production remains on its six-level catalog. The Round 9 development branch has ten deterministic Adventure candidates plus eight QA-only composition experiments; the five Round 9D definitions pass geometry, frozen fingerprint, solver, and exhaustive reachable-state checks.
- Round 9 candidate progress uses catalog-versioned saves. Retired puzzle progress does not carry over, while theme and sound preferences remain separate.
- Physical iPhone Safari playtesting was not performed in this release. Confirm gestures, safe areas, zoom, splash timing, and frame pacing on a device before public announcement.
- The ten Round 9 candidates and eight review prototypes are not permanent Adventure levels. This branch is prepared for isolated QA review only; production has not been changed. Obtain visual approval before promoting or adding content.
- Free Play, tutorials, black holes, switches, gates, portals, and additional chapters are future work.
