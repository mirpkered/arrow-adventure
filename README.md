# Arrow Adventure

Arrow Adventure is a mobile-first, advertisement-free puzzle game from MIRPWORKS. Clear each board by selecting winding arrows in an order that lets their heads follow their paths and their bodies trail behind. The approved Round 11A foundation now continues into larger First Flight boards: Levels 1–5 are preserved, followed by a dense 10×10 Level 6, 12×12 Level 7, and 14×14 Level 8.

Production: <https://mirpkered.github.io/arrow-adventure/>

Separate QA Pages deployment is paused while larger boards are developed and tested through validated production releases. See [environment and release procedures](docs/QA_ENVIRONMENT.md).

## Play

The Mirpworks startup splash leads to the title menu. Choose **Play** to begin at Level 1, or **Continue** to restore the last stable board state. Progress and settings save locally on this device. The game uses save schema v4 and catalog `first-flight-r4-large-grid`. Catalog additions preserve compatible in-progress boards; per-level content versions restart only a board whose geometry changed. Completed-level credit and appearance/audio preferences remain intact.

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

For local-only QA tool testing (this does not publish a QA deployment):

```powershell
$env:VITE_BASE_PATH='/arrow-adventure-qa/'
$env:VITE_QA_MODE='true'
$env:VITE_CANDIDATE_SHA='local-preview'
npm run build
```

Developer diagnostics are available only in development or builds with `VITE_QA_MODE=true`; they are excluded from production bundles. Historical prototype definitions and the paused QA deployment are retained for future review, but are not part of Adventure Mode.

## Deployment

Validated changes are developed on feature branches, then safely fast-forwarded or merged into `main`. The production-only GitHub Actions workflow runs tests, TypeScript validation, geometry and solvability checks, builds with `/arrow-adventure/`, excludes developer tools, deploys Pages, and verifies the live source SHA and assets. There is no QA gate or QA-to-production synchronizer. See [environment and release procedures](docs/QA_ENVIRONMENT.md).

## Architecture

- `src/game/catalog.ts` and `src/game/adventure-catalog.json` — eight frozen First Flight levels: the Round 11A opening five, 10×10 Level 6, 12×12 Level 7, and 14×14 Level 8. Stable IDs, per-level content versions, explicit true-grid specifications, metadata, geometry checks, and solvability certification are preserved. Levels through 6 receive exhaustive state audits; Levels 7–8 use the complete static blocker-DAG proof. Round 10 definitions are frozen in `src/game/archive/adventure-catalog-first-flight-r2.json`.
- `src/game/prototypes/round9c-prototypes.json`, `round9d-prototypes.json`, `round9e-square-15.json`, `round9f-square-7.json`, `round9g-square-7-weave.json`, and `round9h-square-true-7.json` — eight Round 9C/D QA review boards plus separate, frozen Round 9E–9H experiments; A–H and the explicit Round 9H choice are loaded only by QA Prototype Review, never by Adventure Mode.
- `src/game/archive/catalog-round8.ts` and `adventure-catalog-first-flight-r1.json` — non-playable archives of the former six-level release definitions and ten provisional Round 9 levels.
- `src/game/geometry.ts`, `src/game/rules.ts`, `src/game/density.ts`, `src/game/stateAudit.ts` — shared board-coordinate transforms, fixed collision envelopes, grid and segment validation, distance-based body movement, solver, exact reachable-state audit through 20 arrows, and a static blocker-graph proof for the current removal-only rules.
- `src/app/boardGrid.ts` — fine-grid paths rendered in the same SVG coordinate frame as the arrows.
- `src/game/session.ts` — heart and run-state helpers.
- `src/app/viewport.ts` — fitted board view, pinch zoom, pan, and reset.
- `src/app/persistence.ts` — versioned local progress/settings with separate QA and production keys.
- `src/app/audio.ts` — optional synthesized music and original sound effects using Web Audio.
- `src/app/launchSplash.ts` — one-time Mirpworks splash sequence adapted from Word Search Adventure.
- `src/main.ts` — title/menu flow, SVG board, delegated touch handling, rAF movement and save orchestration.
- `src/qa/qaPanel.ts` — development/QA-only testing controls, dynamically imported.

Puzzle geometry and collision assumptions are documented in [Game Design](docs/GAME_DESIGN.md). The exact all-state solvability audit and Level 4 reconstruction are in [Solvability Audit](docs/SOLVABILITY_AUDIT.md). The repeatable process for curated content is in [Level Authoring](docs/LEVEL_AUTHORING.md).

The [Round 11 compactness report](docs/ROUND_11_COMPACTNESS.md) documents the five-level refinement and save migration. The [Round 10 foundation report](docs/ROUND_10_FOUNDATION.md) preserves the original layout metrics. Round 9H remains a historical reference for the physical iPhone-approved movement and grid standard. Round 13 records the production transition and larger-grid work in [the baseline](docs/ROUND_13_BASELINE.md) and [the expansion report](docs/ROUND_13_LARGE_GRID_EXPANSION.md).

## Current scope and limitations

- The Round 11A opening five retain their stable IDs, dimensions, routes, and content versions; Level 3 c05 uses the corrected exit orientation. Levels 6–8 are appended as separate frozen 10×10, 12×12, and 14×14 puzzles.
- Round 11 uses schema v4 content-version migration and preserves completed-level credit and unrelated appearance/audio settings.
- Round 11A's c05 investigation, correction, and motion-frame previews are in [docs/ROUND_11A_C05.md](docs/ROUND_11A_C05.md).
- Round 11 previews are renderer-generated, not browser captures. The five-level foundation and c05 correction were physically reviewed on iPhone before this production transition.
- Historical prototypes remain outside the Adventure catalog. The production build verifies that QA modules, prototype selection, and QA metadata are absent.
- New Levels 6–8 have automated geometry, solvability, viewport, selection, and simulator-replay checks; physical iPhone playtesting of these new boards remains outstanding.
- Free Play, tutorials, black holes, switches, gates, portals, and additional chapters are future work.
