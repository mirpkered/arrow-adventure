# Arrow Adventure

Arrow Adventure is a mobile-first, advertisement-free puzzle game from Merpworks. Clear each board by selecting winding arrows in an order that lets their heads follow their paths and their bodies trail behind. The redesign replaces the former 40-level game with a new six-level shared-board collection.

Production: <https://mirpkered.github.io/arrow-adventure/>

Independent QA: <https://mirpkered.github.io/arrow-adventure-qa/>

## Play

The Merpworks startup splash leads to the title menu. Choose **Play** to begin at Level 1, or **Continue** to restore the last stable board state. The game saves progress and settings locally on this device. Existing saves from the former release use different keys and are ignored.

Tap an arrow to try to clear it. It follows its winding route, then travels in its final heading until its whole body exits. If blocked, the arrow moves to the collision point, turns red, and returns along its path; it stays red until successfully cleared. Each failed attempt costs one of three hearts, including a repeat attempt on a red arrow. Restart resets the level and hearts. There is no undo, timer, advertising, or monetization.

The board fits the available viewport, supports pinch zoom and panning, and has a reset-view control. Touch hit tolerance is independent of visible line thickness. Light is the default on first launch; saved Light, Dark, or Automatic preferences are respected. The interface follows device appearance when Automatic is selected, respects safe areas, and shortens motion for reduced-motion preferences.

## Menus and settings

The full-screen title scene uses an original static portrait landscape at `public/branding/arrow-adventure-title-scene.svg`; the approved square logo remains unchanged for icons and credits. It presents Play, Continue, Settings, and Credits. The in-game menu offers resume, restart, settings, and return to title. Settings save Light/Dark/Automatic appearance, optional background music, and independently optional sound effects. Background music is a quiet synthesized original loop; it is off by default. The game does not pause or replace music from Apple Music, Spotify, or other services.

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

The QA panel is available only in development or builds with `VITE_QA_MODE=true`. Hold the level label for two seconds (or use Enter/Space when focused) to open speed, stroke, diagnostics, level navigation, restart, and reset controls. It reports the actual legal moves, remaining IDs, a solver route, collision details for a selected arrow, and can highlight one safe move. QA jumps and restarts are temporary. QA and production use separate local-storage namespaces because both Pages sites share the same browser origin.

## Deployment

`main` deploys to production with `/arrow-adventure/` using GitHub Actions. The standalone [`arrow-adventure-qa`](https://github.com/mirpkered/arrow-adventure-qa) repository has a manually dispatched workflow that checks out an explicitly selected source SHA, validates it, builds with `/arrow-adventure-qa/`, and publishes only to the QA Pages repository. Changing QA cannot deploy to production. See [QA environment and release procedures](docs/QA_ENVIRONMENT.md).

## Architecture

- `src/game/catalog.ts` — six fixed, solver-screened shared-board puzzles and integrity checks.
- `src/game/geometry.ts`, `src/game/rules.ts` — canonical collision envelopes, path validation, distance-based body movement, solver, and layout metrics.
- `src/game/session.ts` — heart and run-state helpers.
- `src/app/viewport.ts` — fitted board view, pinch zoom, pan, and reset.
- `src/app/persistence.ts` — versioned local progress/settings with separate QA and production keys.
- `src/app/audio.ts` — optional synthesized music and original sound effects using Web Audio.
- `src/app/launchSplash.ts` — one-time Merpworks splash sequence adapted from Word Search Adventure.
- `src/main.ts` — title/menu flow, SVG board, delegated touch handling, rAF movement and save orchestration.
- `src/qa/qaPanel.ts` — development/QA-only testing controls, dynamically imported.

Puzzle geometry and collision assumptions are documented in [Game Design](docs/GAME_DESIGN.md). The exact all-state solvability audit and Level 4 reconstruction are in [Solvability Audit](docs/SOLVABILITY_AUDIT.md). The repeatable process for curated content is in [Level Authoring](docs/LEVEL_AUTHORING.md).

The baseline measurements and recommended method for the separate future puzzle-density redesign are in [Round 7A Density Plan](docs/ROUND_7A_DENSITY_PLAN.md). That plan does not change the current levels or gameplay rules.

## Current scope and limitations

- Six curated prototype levels, Levels 1–6. These replace the earlier 40 levels; their progress is not imported.
- Puzzle content is solver-verified and fingerprinted. Future levels should keep the intentionally varied, densely shared-board geometry.
- Physical iPhone Safari playtesting was not performed in this release. Confirm gestures, safe areas, zoom, splash timing, and frame pacing on a device before public announcement.
- Free Play, tutorials, black holes, switches, gates, portals, and additional chapters are future work.
