# Shared-Board Game Design

## Active prototype rules

The redesign uses a single board containing winding arrows. Each arrow is an ordered set of adjacent grid points from tail to head. Consecutive points can move one cell horizontally, vertically, or diagonally. The final segment sets the arrow's exit heading.

When selected, the line is pulled by distance along its complete stored route. Every body vertex follows the same route distance, preserving the winding shape as the head advances and the tail retracts. Past the final point, the line extends along the final heading. Rendering runs on `requestAnimationFrame` at a constant board-cell speed and updates the existing SVG nodes without rebuilding the screen. Restart invalidates any active animation frame sequence.

For every 0.05 board-cell sweep sample, the simulator checks the moving arrow's complete polyline and arrowhead against every remaining arrow. It adds the maximum sample travel as conservative clearance, so collision does not depend on display frame pacing. Collision uses continuous segment distance for body strokes plus triangular arrowhead checks. Static validation rejects disconnected routes, self-crossings, out-of-board points, duplicate arrow IDs, and visible overlap. The solver calls the same simulator as gameplay, so a removal order is valid under the same collision rules used for moves. Visible body width is selectable at 0.12, 0.15 (default), or 0.18 cells; movement collision uses the same width, and catalog validation uses the boldest setting. Animation speed is a time multiplier only and does not change collision or solver results.

Arrow selection uses one delegated `pointerdown` handler. Pointer coordinates are transformed into SVG board coordinates and compared with each line; the nearest centerline within 0.75 cells wins, with arrow ID as the deterministic tie-break. This gives an invisible hit region about 1.5 board cells across without thickening the art. The separate click handler only handles controls, so a synthesized touch click cannot trigger a second arrow action.

The game opens directly into a viewport-filling play screen. It uses dynamic viewport sizing and safe-area insets. In development and explicitly flagged QA builds, holding the compact level label for two seconds opens temporary settings; release, cancellation, or pointer drift over ten CSS pixels cancels the hold. Enter or Space opens the panel for keyboard testing. The panel adjusts animation speed and stroke width, toggles diagnostics, jumps among the six levels, restarts, or resets settings. These controls remain in memory only. Production Pages builds do not set the QA flag.

## Level set and progression

`src/game/catalog.ts` is the complete prototype catalog. Each entry contains a stable local ID, display number, short title, provisional difficulty, authoring note, and exact deterministic puzzle definition. The set is intentionally limited to six puzzles. Catalog validation requires 5–10 contiguous entries starting at Level 1, validates every board, rejects weak layouts using route-contact metrics, and rejects entries the solver cannot clear. This round does not alter the six puzzle definitions; visual replacement remains pending the three reference screenshots required by the request.

Progression exists only in memory while the page is open. Completion advances to the next number; restart restores the current authored board and three hearts. A fresh page load always starts at Level 1. The runtime does not access browser local storage, so v1/v2 progress and tutorial values from earlier releases cannot influence play. The old keys are left untouched as inert data.

## Interlocking metrics and content review

`analyzeLevel` counts segment-pair contacts within 1.5 cells, and counts an arrow pair as interleaved only when at least three segments from each route participate. This tests repeated close runs rather than bounding-box overlap. It also reports initially removable arrows, newly unlocked arrows per initial safe removal, path lengths, turns, and elimination dependency depth. Numeric checks screen weak candidates but do not prove visual quality; manual board review remains mandatory. The current six definitions retain their prior metrics and still need the denser composition requested for this round.

The six current definitions remain unchanged for this round while the required reference images are unavailable.

## Content review

Automated solvability proves only that at least one legal removal sequence exists. Before adding content, playtest the path reading, number of safe openings, dependency depth, line density, turn variety, and perceived difficulty. Review mobile touch targets and whether animation makes body-following understandable. Keep authored paths in the catalog; do not generate layouts at runtime.

## Branding and delivery

The approved logo master remains at `public/branding/arrow-adventure-official-logo.png`, with resized icons in `public/icons/` and PWA metadata in `public/site.webmanifest`. The established Vite `/arrow-adventure/` base path and Pages workflow remain available, but the redesign branch is not published to production.

## Deferred features

The prototype has no saved progression, chapter UI, level picker, tutorial system, generator, Free Play, black holes, switches, gates, portals, undo, or timer. Revisit those after playtesting establishes the new foundational board and level model.
