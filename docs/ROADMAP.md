# Arrow Adventure Redesign Roadmap

This roadmap describes the reset prototype on `redesign/shared-board-prototype`. The earlier Adventure catalog and progress model were deliberately discarded for this redesign. This branch is for review and local playtesting; it is not deployed to production.

## Current redesign prototype

- Six newly authored shared-board puzzles, numbered 1–6.
- Winding cardinal and diagonal arrow paths, monochrome rendering, path-following movement, shared collision geometry, and solver verification.
- Three hearts, restart, and in-memory progression for the current browser session.
- Every fresh page load starts at Level 1. There is no progression persistence and no compatibility read of old local-storage keys.
- Official logo, PWA metadata, icons, Vite base path, and GitHub Pages workflow are retained.
- An independent manual QA Pages site builds and identifies selected feature commits without deploying them to production.
- This correction round tightens the six boards with route-contact thresholds, distance-driven requestAnimationFrame movement, and nearest-path pointer selection. It remains a playtest candidate and is not approved for production.

The old 40 puzzles, versioned catalogs, tile-serpentine generator, save migration, saved progression, and one-time diagonal tutorial were removed from this branch.

QA hosting and release instructions are documented in [QA_ENVIRONMENT.md](QA_ENVIRONMENT.md). The initial QA deployment used the expected prototype commit and left production `main` and its Pages workflow untouched.

## Review gates

1. Play all six boards on iPhone Safari. Review the thinner strokes, close path separation, one-tap hit selection, animation frame pacing, blocked-move heart loss, and dependency order. Physical-device validation remains outstanding for this correction round.
2. Revise the curated boards from observations; keep solver and geometry checks passing.
3. Agree on a stable content direction before adding further puzzles or restoring persistent progression.
4. Keep this redesign off the production Pages deployment until the gameplay has been reviewed and approved.

## Later work, only after review

- Decide whether the redesigned board representation needs non-grid coordinates or additional arrow segment semantics.
- Expand the curated set only when new puzzles add useful teaching or decision variety.
- Revisit save data and progression only after the level identity and content model are accepted.
- Design and implement future mechanics separately, with explicit rules and solver support.
