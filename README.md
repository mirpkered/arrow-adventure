# Arrow Adventure

Arrow Adventure is a mobile-first, advertisement-free puzzle game from MIRPWORKS. Clear each board by selecting winding arrows in an order that lets their heads follow their paths and their bodies trail behind. The Round 10 development branch replaces the provisional Adventure catalog with five individually authored, deterministic true-grid levels. The former six-level release remains in production until the developer reviews the new catalog on iPhone.

Production: <https://mirpkered.github.io/arrow-adventure/>

Independent QA: <https://mirpkered.github.io/arrow-adventure-qa/>

## Play

The Mirpworks startup splash leads to the title menu. Choose **Play** to begin at Level 1, or **Continue** to restore the last stable board state. Progress and settings save locally on this device. Round 10 uses game-save schema v3 and catalog `first-flight-r2-true-grid`; prior Adventure progress is reset when this catalog is first opened, while appearance and audio preferences remain intact.

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

The QA panel is available only in development or builds with `VITE_QA_MODE=true`. Hold the level label for two seconds (or use Enter/Space when focused) to open speed, stroke, diagnostics, level navigation, restart, reset, and Prototype Review controls. Prototype Review retains the A–H comparisons and the separate **Round 9H — True 7×7 Square** board. Review runs use the same gameplay systems but never write Adventure Mode progress. QA and production use separate local-storage namespaces because both Pages sites share the same browser origin.

## Deployment

`main` deploys to production with `/arrow-adventure/` using GitHub Actions. The standalone [`arrow-adventure-qa`](https://github.com/mirpkered/arrow-adventure-qa) repository has a manually dispatched workflow that checks out an explicitly selected source SHA, validates it, builds with `/arrow-adventure-qa/`, and publishes only to the QA Pages repository. Changing QA cannot deploy to production. See [QA environment and release procedures](docs/QA_ENVIRONMENT.md).

## Architecture

- `src/game/catalog.ts` and `src/game/adventure-catalog.json` — five frozen Round 10 levels with stable IDs, a versioned chapter, explicit true-grid specifications, metadata, fingerprints, geometry checks, and exhaustive state audits.
- `src/game/prototypes/round9c-prototypes.json`, `round9d-prototypes.json`, `round9e-square-15.json`, `round9f-square-7.json`, `round9g-square-7-weave.json`, and `round9h-square-true-7.json` — eight Round 9C/D QA review boards plus separate, frozen Round 9E–9H experiments; A–H and the explicit Round 9H choice are loaded only by QA Prototype Review, never by Adventure Mode.
- `src/game/archive/catalog-round8.ts` and `adventure-catalog-first-flight-r1.json` — non-playable archives of the former six-level release definitions and ten provisional Round 9 levels.
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

The [Round 10 foundation report](docs/ROUND_10_FOUNDATION.md) documents the five true-grid levels, fingerprints, exact audits, previews, and save reset. The earlier Round 9H design is preserved as a separate QA prototype and remains the physical iPhone-approved movement and grid reference.

## Current scope and limitations

- Production remains unchanged on the six-level release. The Round 10 development catalog contains five levels and 50 arrows; the total exact audit covered 507 reachable states and 1,430 legal transitions.
- Round 10 resets old Adventure completion records through the v3 save boundary and preserves local appearance/audio settings.
- Round 10 portrait images are renderer-generated. The developer's earlier Round 9H physical iPhone test passed; these five levels still require physical iPhone playtesting before production promotion.
- The five catalog levels are separate from QA-only A–H and Round 9H review prototypes. This candidate is for isolated QA only; production has not been changed.
- Free Play, tutorials, black holes, switches, gates, portals, and additional chapters are future work.
