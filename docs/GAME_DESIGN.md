# Shared-Board Game Design

## Active prototype rules

The redesign uses a single board containing winding arrows. Each arrow is an ordered set of adjacent grid points from tail to head. Consecutive points can move one cell horizontally, vertically, or diagonally. The final segment sets the arrow's exit heading.

When selected, each body point advances toward the next point in the stored route. The head continues in its final heading, and the tail releases points behind it. `simulateMove` produces four interpolated geometry samples per grid step until the full body leaves the board. The UI animates these returned frames directly.

For every sample, the simulator checks the moving arrow's complete polyline and arrowhead against every remaining arrow. Collision is based on rendered geometry: continuous segment distance for body strokes, plus triangular arrowhead checks. Static validation rejects disconnected routes, self-crossings, out-of-board points, duplicate arrow IDs, and visible overlap. The solver calls the same simulator as gameplay, so a removal order is valid under the same collision rules used for moves.

## Level set and progression

`src/game/catalog.ts` is the complete authored prototype catalog. Each entry contains a stable local ID, display number, short title, provisional difficulty, authoring note, and exact puzzle definition. The set is intentionally limited to six puzzles. Catalog validation requires 5–10 contiguous entries starting at Level 1, validates every board, and rejects entries the solver cannot clear.

Progression exists only in memory while the page is open. Completion advances to the next number; restart restores the current authored board and three hearts. A fresh page load always starts at Level 1. The runtime does not access browser local storage, so v1/v2 progress and tutorial values from earlier releases cannot influence play. The old keys are left untouched as inert data.

## Content review

Automated solvability proves only that at least one legal removal sequence exists. Before adding content, playtest the path reading, number of safe openings, dependency depth, line density, turn variety, and perceived difficulty. Review mobile touch targets and whether animation makes body-following understandable. Keep authored paths in the catalog; do not generate layouts at runtime.

## Branding and delivery

The approved logo master remains at `public/branding/arrow-adventure-official-logo.png`, with resized icons in `public/icons/` and PWA metadata in `public/site.webmanifest`. The established Vite `/arrow-adventure/` base path and Pages workflow remain available, but the redesign branch is not published to production.

## Deferred features

The prototype has no saved progression, chapter UI, level picker, tutorial system, generator, Free Play, black holes, switches, gates, portals, undo, or timer. Revisit those after playtesting establishes the new foundational board and level model.
