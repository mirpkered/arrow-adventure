# Arrow Adventure

Arrow Adventure is a mobile-first, advertisement-free puzzle game from MIRPWORKS. Clear each board by selecting winding arrows in an order that lets their heads follow their paths and their bodies trail behind. The Round 11 development candidate refines the five approved Adventure levels into denser, more interwoven true-grid compositions. Round 11A also corrects Level 3's c05 head direction after physical playtest feedback; Round 10 remains in production pending review.

Production: <https://mirpkered.github.io/arrow-adventure/>

Independent QA: <https://mirpkered.github.io/arrow-adventure-qa/>

## Play

The Mirpworks startup splash leads to the title menu. Choose **Play** to begin at Level 1, or **Continue** to restore the last stable board state. Progress and settings save locally on this device. Round 11 uses game-save schema v4 and catalog `first-flight-r3-compact-weave`. It migrates Round 10 schema-v3 progress by preserving completed-level credit and current selection, restarting only an in-progress puzzle whose geometry changed, and leaving appearance/audio preferences intact.

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

- `src/game/catalog.ts` and `src/game/adventure-catalog.json` — five frozen Round 11 compactness-refined levels with stable IDs, a versioned chapter, explicit true-grid specifications, metadata, fingerprints, geometry checks, and exhaustive state audits. Round 10 definitions are frozen in `src/game/archive/adventure-catalog-first-flight-r2.json`.
- `src/game/prototypes/round9c-prototypes.json`, `round9d-prototypes.json`, the frozen Round 9E–9H definitions, and `round12-heart.json` — QA-only review boards and experiments. A–H, the explicit Round 9H choice, and the Round 12 heart are loaded only by QA Prototype Review, never by Adventure Mode.
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

The [Round 11 compactness report](docs/ROUND_11_COMPACTNESS.md) documents the before/after measurements, five-level previews, exact audits, and save migration. The [Round 10 foundation report](docs/ROUND_10_FOUNDATION.md) preserves the original layout metrics. Round 9H remains a separate QA prototype and the physical iPhone-approved movement and grid reference. [Round 12](docs/ROUND_12_HEART.md) documents the first full-area silhouette prototype and its QA-only clipped-grid rendering.

## Current scope and limitations

- Round 11 keeps five levels and 50 arrows; all five use the same board dimensions and true-grid rules as the physically approved Round 10 foundation. The exact audit covers every reachable state in the candidate catalog.
- Round 11 uses schema v4 content-version migration and preserves completed-level credit and unrelated appearance/audio settings.
- Round 11A's c05 investigation, correction, and motion-frame previews are in [docs/ROUND_11A_C05.md](docs/ROUND_11A_C05.md).
- Round 11 previews are renderer-generated, not browser captures. The candidate still requires physical iPhone review before production promotion.
- The five catalog levels are separate from QA-only A–H, Round 9H, and Round 12 review prototypes. Production synchronization validates the active catalog and tree-shakes QA-only tools.
- Free Play, tutorials, black holes, switches, gates, portals, and additional chapters are future work.
