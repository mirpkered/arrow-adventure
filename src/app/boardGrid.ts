import { LEGACY_GRID_SPECIFICATION } from '../game/geometry';
import { toBoardPoint } from '../game/geometry';
import type { GridSpecification, Point } from '../game/types';

/** Draws exactly the configured visible lattice; omitted specs preserve the legacy half-unit grid. */
export function boardGridMarkup(width: number, height: number, showMajorGrid = false, grid: GridSpecification = LEGACY_GRID_SPECIFICATION): string {
  const fine: string[] = [];
  const major: string[] = [];
  const xCount = Math.round(width / grid.spacing);
  const yCount = Math.round(height / grid.spacing);
  const majorEvery = Math.max(1, Math.round(1 / grid.spacing));
  for (let index = 0; index <= xCount; index += 1) {
    const x = grid.origin.x + index * grid.spacing;
    const target = index % majorEvery === 0 ? major : fine;
    target.push(`M ${x} ${grid.origin.y} V ${grid.origin.y + height}`);
  }
  for (let index = 0; index <= yCount; index += 1) {
    const y = grid.origin.y + index * grid.spacing;
    const target = index % majorEvery === 0 ? major : fine;
    target.push(`M ${grid.origin.x} ${y} H ${grid.origin.x + width}`);
  }
  return `<g class="grid-lines" aria-hidden="true"><path class="grid-fine" d="${fine.join(' ')}" /><path class="grid-major ${showMajorGrid ? 'is-debug' : ''}" d="${major.join(' ')}" /></g>`;
}

/** Clips only the visible grid to an authored shape; arrow geometry and coordinates stay on the regular lattice. */
export function silhouetteGridMarkup(width: number, height: number, footprint: Point[][], showMajorGrid = false, grid: GridSpecification = LEGACY_GRID_SPECIFICATION): string {
  if (!footprint.length || footprint.some((polygon) => polygon.length < 3)) throw new Error('A silhouette grid needs at least one polygon with three vertices');
  const path = footprint.map((polygon) => `${polygon.map((point, index) => {
    const board = toBoardPoint(point, grid.pathOffset);
    return `${index === 0 ? 'M' : 'L'} ${board.x} ${board.y}`;
  }).join(' ')} Z`).join(' ');
  return `<defs><clipPath id="active-silhouette-clip" clipPathUnits="userSpaceOnUse"><path d="${path}" fill-rule="evenodd" /></clipPath></defs>
    <path class="board-footprint-fill" d="${path}" fill-rule="evenodd" aria-hidden="true" />
    <g clip-path="url(#active-silhouette-clip)">${boardGridMarkup(width, height, showMajorGrid, grid)}</g>
    <path class="board-footprint-outline" d="${path}" aria-hidden="true" />`;
}
