import type { Arrow, GridSpecification, Level, MoveResult, Point } from './types';
import { arrowsCollide, findSelfBodyClearanceIssue, findSelfHeadClearanceIssue, segmentDistance, ARROW_COLLISION_WIDTH, LEGACY_GRID_SPECIFICATION, PATH_POINT_OFFSET, isBoardGridIntersection, pointToPolylineDistance, toBoardPoint, toPathPoint } from './geometry';

/** Maximum sweep sampling interval, in board-cell distances. */
export const COLLISION_STEP = 0.05;
/** Kept as a compatibility export for callers that describe sub-grid samples. */
export const MOVE_SUBSTEPS = 1 / COLLISION_STEP;
export const TOUCH_PICK_RADIUS = 0.75;
const validatedSelfMotion = new WeakMap<Arrow, string>();

/** Deterministic closest-path hit testing, used for mouse and touch alike. */
export function nearestArrowAt(point: Point, arrows: Arrow[], radius = TOUCH_PICK_RADIUS, pathOffset = LEGACY_GRID_SPECIFICATION.pathOffset): string | undefined {
  return arrows.map((arrow) => ({ arrow, distance: pointToPolylineDistance(point, arrow.path, pathOffset) }))
    .filter(({ distance }) => distance <= radius)
    .sort((left, right) => left.distance - right.distance || left.arrow.id.localeCompare(right.arrow.id))[0]?.arrow.id;
}

export const pointKey = ({ x, y }: Point): string => `${x},${y}`;

export function exitDirection(arrow: Arrow): Point {
  const last = arrow.path.at(-1);
  const previous = arrow.path.at(-2);
  if (!last || !previous) throw new Error(`${arrow.id} needs a head and a preceding path cell`);
  return { x: last.x - previous.x, y: last.y - previous.y };
}

export function directionName(direction: Point): string {
  const names: Record<string, string> = {
    '1,0': 'east', '1,-1': 'northeast', '0,-1': 'north', '-1,-1': 'northwest',
    '-1,0': 'west', '-1,1': 'southwest', '0,1': 'south', '1,1': 'southeast',
  };
  const name = names[`${direction.x},${direction.y}`];
  if (name) return name;
  throw new Error(`Invalid exit direction (${direction.x}, ${direction.y})`);
}

function fullyExited(points: Point[], width: number, height: number, direction: Point, grid: GridSpecification = LEGACY_GRID_SPECIFICATION): boolean {
  const margin = 0.3;
  const centers = points.map((point) => toBoardPoint(point, grid.pathOffset));
  const minX = grid.origin.x; const maxX = grid.origin.x + width;
  const minY = grid.origin.y; const maxY = grid.origin.y + height;
  if (direction.x > 0 && direction.y === 0) return centers.every(({ x }) => x >= maxX + margin);
  if (direction.x < 0 && direction.y === 0) return centers.every(({ x }) => x <= minX - margin);
  if (direction.y > 0 && direction.x === 0) return centers.every(({ y }) => y >= maxY + margin);
  if (direction.y < 0 && direction.x === 0) return centers.every(({ y }) => y <= minY - margin);
  const beyondX = direction.x > 0 ? centers.every(({ x }) => x >= maxX + margin) : centers.every(({ x }) => x <= minX - margin);
  const beyondY = direction.y > 0 ? centers.every(({ y }) => y >= maxY + margin) : centers.every(({ y }) => y <= minY - margin);
  return beyondX || beyondY;
}

export function validateArrow(arrow: Arrow, width: number, height: number, levelNumber?: number, grid: GridSpecification = LEGACY_GRID_SPECIFICATION): void {
  const label = `Level ${levelNumber ?? 'unknown'} arrow ${arrow.id}`;
  if (arrow.path.length < 2) throw new Error(`${label}: needs at least two path points`);
  const signature = selfMotionSignature(arrow, width, height, grid);
  if (validatedSelfMotion.get(arrow) === signature) return;
  const seen = new Set<string>();
  arrow.path.forEach((point, index) => {
    const outsideX = point.x < 0 || (grid.includeOuterBoundary ? point.x > width : point.x >= width);
    const outsideY = point.y < 0 || (grid.includeOuterBoundary ? point.y > height : point.y >= height);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || outsideX || outsideY) {
      throw new Error(`${label}: path point ${index} leaves the board at ${pointKey(point)}`);
    }
    const boardPoint = toBoardPoint(point, grid.pathOffset);
    if (!isBoardGridIntersection(boardPoint, grid.spacing, grid.origin)) throw new Error(`${label}: vertex ${index} at (${boardPoint.x}, ${boardPoint.y}) is not on the ${grid.spacing}-unit board grid`);
    const key = pointKey(point);
    if (index > 0) {
      const previous = arrow.path[index - 1];
      if (Math.abs(previous.x - point.x) <= 1e-8 && Math.abs(previous.y - point.y) <= 1e-8) {
        throw new Error(`${label}: zero-length segment ${index - 1} at ${key}`);
      }
    }
    if (seen.has(key)) throw new Error(`${label}: path crosses itself at point ${index}, coordinate ${key}`);
    seen.add(key);
    if (index > 0) {
      const previous = arrow.path[index - 1];
      const dx = Math.abs(previous.x - point.x);
      const dy = Math.abs(previous.y - point.y);
      if (Math.abs(Math.max(dx, dy) - 1) > 1e-8) throw new Error(`${label}: segment ${index - 1} has invalid length at ${pointKey(previous)} → ${key}; expected one board unit`);
      if (dx > 1e-8 && dy > 1e-8 && Math.abs(dx - dy) > 1e-8) throw new Error(`${label}: segment ${index - 1} is not a 45° diagonal at ${pointKey(previous)} → ${key}; horizontal and vertical displacement differ`);
    }
  });
  const pathSegments = arrow.path.slice(1).map((point, index) => ({ a: arrow.path[index], b: point }));
  for (let left = 0; left < pathSegments.length; left += 1) {
    for (let right = left + 2; right < pathSegments.length; right += 1) {
      const clearance = segmentDistance(pathSegments[left], pathSegments[right]);
      if (clearance <= ARROW_COLLISION_WIDTH + 1e-8) {
        throw new Error(`${label}: self-intersection or insufficient body clearance between segments ${left} and ${right} near ${pointKey(pathSegments[left].a)}; measured ${clearance.toFixed(4)} cells, minimum ${ARROW_COLLISION_WIDTH} cells`);
      }
    }
  }
  validateArrowSelfTraversal(arrow, width, height, levelNumber, grid);
  validatedSelfMotion.set(arrow, signature);
}

function selfMotionSignature(arrow: Arrow, width: number, height: number, grid: GridSpecification): string {
  return `${width}x${height}:${JSON.stringify(grid)}:${JSON.stringify(arrow.path)}`;
}

/**
 * Validates the complete pulled-body motion against the arrow's unretracted
 * body. Sampling uses the same movement primitive as rendering; an extra
 * COLLISION_STEP clearance makes the check conservative between samples.
 */
export function validateArrowSelfTraversal(arrow: Arrow, width: number, height: number, levelNumber?: number, grid: GridSpecification = LEGACY_GRID_SPECIFICATION): void {
  const label = `Level ${levelNumber ?? 'unknown'} arrow ${arrow.id}`;
  const direction = exitDirection(arrow);
  const routeLength = arrow.path.slice(1).reduce((sum, point, index) => sum + distance(arrow.path[index], point), 0);
  const maximumTravel = routeLength + Math.hypot(width, height) + 2;
  const samples = Math.ceil(maximumTravel / COLLISION_STEP);
  for (let step = 0; step <= samples; step += 1) {
    const traveled = Math.min(maximumTravel, step * COLLISION_STEP);
    const centers = moveArrowDistance(arrow, traveled, grid.pathOffset);
    const movingPath = centers.map((point) => toPathPoint(point, grid.pathOffset));
    const bodyIssue = findSelfBodyClearanceIssue(movingPath, COLLISION_STEP, grid.pathOffset);
    if (bodyIssue) throw new Error(`${label}: moving body self-collision at travel ${traveled.toFixed(3)} cells, segments ${bodyIssue.segmentAIndex} and ${bodyIssue.segmentBIndex}, near (${bodyIssue.point.x.toFixed(3)}, ${bodyIssue.point.y.toFixed(3)}); measured clearance ${bodyIssue.clearance.toFixed(4)} cells, required > ${bodyIssue.threshold.toFixed(3)}`);
    const headIssue = findSelfHeadClearanceIssue(movingPath, COLLISION_STEP, grid.pathOffset);
    if (headIssue) throw new Error(`${label}: arrowhead self-collision at travel ${traveled.toFixed(3)} cells, head versus segment ${headIssue.segmentAIndex}, near (${headIssue.point.x.toFixed(3)}, ${headIssue.point.y.toFixed(3)}); measured clearance ${headIssue.clearance.toFixed(4)} cells, required > ${headIssue.threshold.toFixed(3)}`);
    if (fullyExited(movingPath, width, height, direction, grid)) return;
  }
  throw new Error(`${label}: exit geometry did not fully clear the board`);
}

export function validateLevel(level: Level): void {
  if (!Number.isInteger(level.width) || level.width < 1 || !Number.isInteger(level.height) || level.height < 1) throw new Error(`Level ${level.number} has invalid dimensions`);
  if (level.arrows.length === 0) throw new Error(`Level ${level.number} is empty`);
  const grid = level.grid ?? LEGACY_GRID_SPECIFICATION;
  if (!Number.isFinite(grid.spacing) || grid.spacing <= 0 || !Number.isFinite(grid.pathOffset)
    || !Number.isFinite(grid.origin.x) || !Number.isFinite(grid.origin.y)
    || Math.abs(level.width / grid.spacing - Math.round(level.width / grid.spacing)) > 1e-8
    || Math.abs(level.height / grid.spacing - Math.round(level.height / grid.spacing)) > 1e-8) {
    throw new Error(`Level ${level.number} has an invalid visible-grid specification`);
  }
  const ids = new Set<string>();
  for (const [index, arrow] of level.arrows.entries()) {
    if (ids.has(arrow.id)) throw new Error(`Level ${level.number} has duplicate arrow ID ${arrow.id}`);
    ids.add(arrow.id);
    validateArrow(arrow, level.width, level.height, level.number, grid);
    for (const other of level.arrows.slice(0, index)) if (arrowsCollide(arrow, other, 0, grid.pathOffset)) throw new Error(`${arrow.id} visually collides with ${other.id}`);
  }
}

function distance(a: Point, b: Point): number { return Math.hypot(b.x - a.x, b.y - a.y); }

function pointAtDistance(route: Point[], stations: number[], at: number, direction: Point): Point {
  const last = route.at(-1)!;
  const total = stations.at(-1)!;
  if (at >= total) {
    const excess = at - total;
    const magnitude = Math.hypot(direction.x, direction.y);
    return { x: last.x + direction.x / magnitude * excess, y: last.y + direction.y / magnitude * excess };
  }
  let segment = 0;
  while (segment < stations.length - 2 && stations[segment + 1] < at) segment += 1;
  const span = stations[segment + 1] - stations[segment];
  const t = (at - stations[segment]) / span;
  return {
    x: route[segment].x + (route[segment + 1].x - route[segment].x) * t,
    y: route[segment].y + (route[segment + 1].y - route[segment].y) * t,
  };
}

/** Position every point of the flexible arrow after it has been pulled this far along its route. */
export function moveArrowDistance(arrow: Arrow, traveled: number, pathOffset = PATH_POINT_OFFSET): Point[] {
  const route = arrow.path.map((point) => toBoardPoint(point, pathOffset));
  const stations = [0];
  for (let index = 1; index < route.length; index += 1) stations.push(stations[index - 1] + distance(route[index - 1], route[index]));
  const direction = exitDirection(arrow);
  const start = traveled;
  const end = stations.at(-1)! + traveled;
  const clipped = [pointAtDistance(route, stations, start, direction)];
  for (const station of stations.slice(1, -1)) if (station > start && station < end) clipped.push(pointAtDistance(route, stations, station, direction));
  clipped.push(pointAtDistance(route, stations, end, direction));
  return clipped;
}

/** Deterministically sample the complete swept body; presentation animation uses an independent rAF clock. */
export function simulateMove(arrow: Arrow, others: Arrow[], width: number, height: number, grid: GridSpecification = LEGACY_GRID_SPECIFICATION): MoveResult {
  // Gameplay refuses malformed content instead of silently animating through
  // the arrow's own unretracted body. Catalog validation performs the same check.
  if (validatedSelfMotion.get(arrow) !== selfMotionSignature(arrow, width, height, grid)) validateArrow(arrow, width, height, undefined, grid);
  const frames: Point[][] = [];
  const direction = exitDirection(arrow);
  if (Math.max(Math.abs(direction.x), Math.abs(direction.y)) !== 1 || (direction.x === 0 && direction.y === 0)) throw new Error(`${arrow.id} has an invalid exit direction`);
  const totalRoute = arrow.path.slice(1).reduce((sum, point, index) => sum + distance(arrow.path[index], point), 0);
  const exitDistance = Math.hypot(width, height) + 2;
  const maxTravel = totalRoute + exitDistance;
  const intervals = Math.ceil(maxTravel / COLLISION_STEP);
  let lastSafeTravel = 0;
  for (let index = 1; index <= intervals; index += 1) {
    const traveled = Math.min(maxTravel, index * COLLISION_STEP);
    const frame = moveArrowDistance(arrow, traveled, grid.pathOffset);
    const moving = { ...arrow, path: frame.map((point) => toPathPoint(point, grid.pathOffset)) };
    const blocker = others.find((other) => arrowsCollide(moving, other, COLLISION_STEP, grid.pathOffset));
    if (blocker) {
      let low = lastSafeTravel;
      let high = traveled;
      // Refine the first deterministic swept-contact sample so the visual impact lands at the blocker.
      for (let refinement = 0; refinement < 7; refinement += 1) {
        const midpoint = (low + high) / 2;
        const impactPath = moveArrowDistance(arrow, midpoint, grid.pathOffset).map((point) => toPathPoint(point, grid.pathOffset));
        if (arrowsCollide({ ...arrow, path: impactPath }, blocker, COLLISION_STEP, grid.pathOffset)) high = midpoint;
        else low = midpoint;
      }
      return { ok: false, blockedBy: blocker.id, travelDistance: high };
    }
    frames.push(moving.path);
    if (fullyExited(moving.path, width, height, direction, grid)) return { ok: true, frames, travelDistance: traveled };
    lastSafeTravel = traveled;
  }
  return { ok: false, blockedBy: 'boundary', travelDistance: maxTravel };
}

/** Pairwise exits are sufficient because every other arrow is stationary during a move. */
const blockerCache = new Map<string, Map<string, Set<string>>>();
const solutionCache = new Map<string, string[] | null>();
function puzzleKey(level: Level): string {
  // Grid interpretation affects bounds, rendering-space offsets, and movement;
  // keep legacy and explicit-grid prototypes from sharing cached solutions.
  return JSON.stringify([level.width, level.height, level.grid ?? LEGACY_GRID_SPECIFICATION, level.arrows]);
}

function buildExitBlockers(level: Level): Map<string, Set<string>> {
  const key = puzzleKey(level);
  const cached = blockerCache.get(key);
  if (cached) return cached;
  const blockers = new Map(level.arrows.map(({ id }) => [id, new Set<string>()]));
  for (const arrow of level.arrows) for (const other of level.arrows) {
    if (arrow.id === other.id) continue;
    if (!simulateMove(arrow, [other], level.width, level.height, level.grid).ok) blockers.get(arrow.id)!.add(other.id);
  }
  if (blockerCache.size >= 64) blockerCache.clear();
  blockerCache.set(key, blockers);
  return blockers;
}

export function solveLevel(level: Level): string[] | null {
  const cacheKey = puzzleKey(level);
  if (solutionCache.has(cacheKey)) return solutionCache.get(cacheKey)?.slice() ?? null;
  const blockers = buildExitBlockers(level);
  const memo = new Set<string>();
  const search = (remaining: Set<string>): string[] | null => {
    if (remaining.size === 0) return [];
    const key = [...remaining].sort().join('|');
    if (memo.has(key)) return null;
    memo.add(key);
    for (const id of remaining) {
      if ([...blockers.get(id)!].some((blocker) => remaining.has(blocker))) continue;
      const next = new Set(remaining);
      next.delete(id);
      const tail = search(next);
      if (tail) return [id, ...tail];
    }
    return null;
  };
  const solution = search(new Set(level.arrows.map(({ id }) => id)));
  if (solutionCache.size >= 64) solutionCache.clear();
  solutionCache.set(cacheKey, solution);
  return solution?.slice() ?? null;
}

export type LevelMetrics = {
  interleavedPairs: number;
  interleavedPairsByArrow: Record<string, number>;
  closeSegmentContacts: number;
  closeSegmentContactsByArrow: Record<string, number>;
  occupancyRatio: number;
  blockingDependencies: number;
  blockersByArrow: Record<string, number>;
  initiallyRemovable: number;
  newlyUnlockedByRemoval: number[];
  dependencyDepth: number;
  pathLengths: number[];
  turnCounts: number[];
};

/** Curation metrics: close parallel/weaving runs count; bounding-box overlap does not. */
export function analyzeLevel(level: Level): LevelMetrics {
  const segmentList = (arrow: Arrow) => arrow.path.slice(1).map((point, index) => ({
    a: toBoardPoint(arrow.path[index]),
    b: toBoardPoint(point),
  }));
  let interleavedPairs = 0;
  const interleavedPairsByArrow: Record<string, number> = Object.fromEntries(level.arrows.map(({ id }) => [id, 0]));
  let closeSegmentContacts = 0;
  const closeSegmentContactsByArrow: Record<string, number> = Object.fromEntries(level.arrows.map(({ id }) => [id, 0]));
  for (let i = 0; i < level.arrows.length; i += 1) for (let j = i + 1; j < level.arrows.length; j += 1) {
    const left = segmentList(level.arrows[i]);
    const right = segmentList(level.arrows[j]);
    const contacts = left.flatMap((a) => right.filter((b) => segmentDistance(a, b) <= 1.5).map((b) => ({ a, b })));
    closeSegmentContacts += contacts.length;
    closeSegmentContactsByArrow[level.arrows[i].id] += contacts.length;
    closeSegmentContactsByArrow[level.arrows[j].id] += contacts.length;
    // Require multiple contact zones spread along both routes, not just a crossing or exit block.
    const leftIndices = new Set<number>();
    const rightIndices = new Set<number>();
    for (let a = 0; a < left.length; a += 1) for (let b = 0; b < right.length; b += 1) {
      if (segmentDistance(left[a], right[b]) <= 1.5) { leftIndices.add(a); rightIndices.add(b); }
    }
    if (leftIndices.size >= 3 && rightIndices.size >= 3) {
      interleavedPairs += 1;
      interleavedPairsByArrow[level.arrows[i].id] += 1;
      interleavedPairsByArrow[level.arrows[j].id] += 1;
    }
  }
  const blockers = buildExitBlockers(level);
  const safe = (remaining: Arrow[]) => remaining.filter((arrow) => ![...blockers.get(arrow.id)!].some((id) => remaining.some((other) => other.id === id)));
  const initiallySafe = safe(level.arrows);
  const newlyUnlockedByRemoval = initiallySafe.map((removed) => {
    const remaining = level.arrows.filter((arrow) => arrow.id !== removed.id);
    const before = new Set(initiallySafe.map(({ id }) => id));
    return safe(remaining).filter(({ id }) => !before.has(id)).length;
  });
  let remaining = [...level.arrows];
  let dependencyDepth = 0;
  while (remaining.length > 0) {
    const unlocked = safe(remaining);
    if (unlocked.length === 0) break;
    dependencyDepth += 1;
    const removed = new Set(unlocked.map(({ id }) => id));
    remaining = remaining.filter(({ id }) => !removed.has(id));
  }
  return {
    interleavedPairs,
    interleavedPairsByArrow,
    closeSegmentContacts,
    closeSegmentContactsByArrow,
    occupancyRatio: level.arrows.reduce((sum, { path }) => sum + path.slice(1).reduce((length, point, index) => length + distance(point, path[index]), 0), 0) / (level.width * level.height),
    blockingDependencies: [...blockers.values()].reduce((sum, ids) => sum + ids.size, 0),
    blockersByArrow: Object.fromEntries([...blockers].map(([id, ids]) => [id, ids.size])),
    initiallyRemovable: safe(level.arrows).length,
    newlyUnlockedByRemoval,
    dependencyDepth,
    pathLengths: level.arrows.map(({ path }) => path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0)),
    turnCounts: level.arrows.map(({ path }) => path.slice(2).filter((point, index) => {
      const previous = path[index + 1]; const before = path[index];
      return point.x - previous.x !== previous.x - before.x || point.y - previous.y !== previous.y - before.y;
    }).length),
  };
}

export function completeLevel(arrows: Arrow[]): boolean { return arrows.length === 0; }

export function movedPathIsOffBoard(frames: Point[][], width: number, height: number): boolean {
  const finalFrame = frames.at(-1) ?? [];
  if (finalFrame.length === 0) return true;
  const margin = 0.3;
  const centers = finalFrame.map((point) => toBoardPoint(point));
  return centers.every(({ x }) => x >= width + margin)
    || centers.every(({ x }) => x <= -margin)
    || centers.every(({ y }) => y >= height + margin)
    || centers.every(({ y }) => y <= -margin);
}
