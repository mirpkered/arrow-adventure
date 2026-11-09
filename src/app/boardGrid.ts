import { BOARD_GRID_SPACING } from '../game/geometry';

/** Draws the board's canonical half-unit lattice in the board SVG coordinate space. */
export function boardGridMarkup(width: number, height: number, showMajorGrid = false): string {
  const fine: string[] = [];
  const major: string[] = [];
  for (let x = 0; x <= width + 1e-8; x += BOARD_GRID_SPACING) {
    (Number.isInteger(x) ? major : fine).push(`M ${x} 0 V ${height}`);
  }
  for (let y = 0; y <= height + 1e-8; y += BOARD_GRID_SPACING) {
    (Number.isInteger(y) ? major : fine).push(`M 0 ${y} H ${width}`);
  }
  return `<g class="grid-lines" aria-hidden="true"><path class="grid-fine" d="${fine.join(' ')}" /><path class="grid-major ${showMajorGrid ? 'is-debug' : ''}" d="${major.join(' ')}" /></g>`;
}
