import type { Arrow, Level, MoveResult, Point } from './types';
import { arrowsCollide, segmentDistance, ARROW_COLLISION_WIDTH, pointToPolylineDistance } from './geometry';

/** Maximum sweep sampling interval, in board-cell distances. */
export const COLLISION_STEP = 0.05;
/** Kept as a compatibility export for callers that describe sub-grid samples. */
export const MOVE_SUBSTEPS = 1 / COLLISION_STEP;
export const TOUCH_PICK_RADIUS = 0.75;

/** Deterministic closest-path hit testing, used for mouse and touch alike. */
export function nearestArrowAt(point: Point, arrows: Arrow[], radius = TOUCH_PICK_RADIUS): string | undefined {
  return arrows.map((arrow) => ({ arrow, distance: pointToPolylineDistance(point, arrow.path) }))
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

function fullyExited(points: Point[], width: number, height: number, direction: Point): boolean {
  const margin = 0.3;
  const centers = points.map((point) => ({ x: point.x + 0.5, y: point.y + 0.5 }));
  if (direction.x > 0 && direction.y === 0) return centers.every(({ x }) => x >= width + margin);
  if (direction.x < 0 && direction.y === 0) return centers.every(({ x }) => x <= -margin);
  if (direction.y > 0 && direction.x === 0) return centers.every(({ y }) => y >= height + margin);
  if (direction.y < 0 && direction.x === 0) return centers.every(({ y }) => y <= -margin);
  const beyondX = direction.x > 0 ? centers.every(({ x }) => x >= width + margin) : centers.every(({ x }) => x <= -margin);
  const beyondY = direction.y > 0 ? centers.every(({ y }) => y >= height + margin) : centers.every(({ y }) => y <= -margin);
  return beyondX || beyondY;
}

export function validateArrow(arrow: Arrow, width: number, height: number): void {
  if (arrow.path.length < 2) throw new Error(`${arrow.id} needs at least two cells`);
  const seen = new Set<string>();
  arrow.path.forEach((point, index) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || Math.abs(point.x * 2 - Math.round(point.x * 2)) > 1e-8 || Math.abs(point.y * 2 - Math.round(point.y * 2)) > 1e-8
      || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
      throw new Error(`${arrow.id} leaves the board at ${pointKey(point)}`);
    }
    const key = pointKey(point);
    if (seen.has(key)) throw new Error(`${arrow.id} crosses itself at ${key}`);
    seen.add(key);
    if (index > 0) {
      const previous = arrow.path[index - 1];
      const dx = Math.abs(previous.x - point.x);
      const dy = Math.abs(previous.y - point.y);
      if (Math.max(dx, dy) !== 1 || (dx > 0 && dy > 0 && Math.abs(dx - dy) > 1e-8)) throw new Error(`${arrow.id} has a disconnected path`);
    }
  });
  const pathSegments = arrow.path.slice(1).map((point, index) => ({ a: arrow.path[index], b: point }));
  for (let left = 0; left < pathSegments.length; left += 1) {
    for (let right = left + 2; right < pathSegments.length; right += 1) {
      if (segmentDistance(pathSegments[left], pathSegments[right]) <= ARROW_COLLISION_WIDTH) {
        throw new Error(`${arrow.id} has a visually self-intersecting path`);
      }
    }
  }
}

export function validateLevel(level: Level): void {
  if (!Number.isInteger(level.width) || level.width < 1 || !Number.isInteger(level.height) || level.height < 1) throw new Error(`Level ${level.number} has invalid dimensions`);
  if (level.arrows.length === 0) throw new Error(`Level ${level.number} is empty`);
  const ids = new Set<string>();
  for (const [index, arrow] of level.arrows.entries()) {
    if (ids.has(arrow.id)) throw new Error(`Level ${level.number} has duplicate arrow ID ${arrow.id}`);
    ids.add(arrow.id);
    validateArrow(arrow, level.width, level.height);
    for (const other of level.arrows.slice(0, index)) if (arrowsCollide(arrow, other)) throw new Error(`${arrow.id} visually collides with ${other.id}`);
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
export function moveArrowDistance(arrow: Arrow, traveled: number): Point[] {
  const route = arrow.path.map((point) => ({ x: point.x + 0.5, y: point.y + 0.5 }));
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
export function simulateMove(arrow: Arrow, others: Arrow[], width: number, height: number): MoveResult {
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
    const frame = moveArrowDistance(arrow, traveled);
    const moving = { ...arrow, path: frame.map((point) => ({ x: point.x - 0.5, y: point.y - 0.5 })) };
    const blocker = others.find((other) => arrowsCollide(moving, other, COLLISION_STEP));
    if (blocker) {
      let low = lastSafeTravel;
      let high = traveled;
      // Refine the first deterministic swept-contact sample so the visual impact lands at the blocker.
      for (let refinement = 0; refinement < 7; refinement += 1) {
        const midpoint = (low + high) / 2;
        const impactPath = moveArrowDistance(arrow, midpoint).map((point) => ({ x: point.x - 0.5, y: point.y - 0.5 }));
        if (arrowsCollide({ ...arrow, path: impactPath }, blocker, COLLISION_STEP)) high = midpoint;
        else low = midpoint;
      }
      return { ok: false, blockedBy: blocker.id, travelDistance: high };
    }
    frames.push(moving.path);
    if (fullyExited(moving.path, width, height, direction)) return { ok: true, frames, travelDistance: traveled };
    lastSafeTravel = traveled;
  }
  return { ok: false, blockedBy: 'boundary', travelDistance: maxTravel };
}

/** Pairwise exits are sufficient because every other arrow is stationary during a move. */
const blockerCache = new Map<string, Map<string, Set<string>>>();
const solutionCache = new Map<string, string[] | null>();
function puzzleKey(level: Level): string { return JSON.stringify([level.width, level.height, level.arrows]); }

function buildExitBlockers(level: Level): Map<string, Set<string>> {
  const key = puzzleKey(level);
  const cached = blockerCache.get(key);
  if (cached) return cached;
  const blockers = new Map(level.arrows.map(({ id }) => [id, new Set<string>()]));
  for (const arrow of level.arrows) for (const other of level.arrows) {
    if (arrow.id === other.id) continue;
    if (!simulateMove(arrow, [other], level.width, level.height).ok) blockers.get(arrow.id)!.add(other.id);
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
  closeSegmentContacts: number;
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
    a: { x: arrow.path[index].x + 0.5, y: arrow.path[index].y + 0.5 },
    b: { x: point.x + 0.5, y: point.y + 0.5 },
  }));
  let interleavedPairs = 0;
  let closeSegmentContacts = 0;
  for (let i = 0; i < level.arrows.length; i += 1) for (let j = i + 1; j < level.arrows.length; j += 1) {
    const left = segmentList(level.arrows[i]);
    const right = segmentList(level.arrows[j]);
    const contacts = left.flatMap((a) => right.filter((b) => segmentDistance(a, b) <= 1.5).map((b) => ({ a, b })));
    closeSegmentContacts += contacts.length;
    // Require multiple contact zones spread along both routes, not just a crossing or exit block.
    const leftIndices = new Set<number>();
    const rightIndices = new Set<number>();
    for (let a = 0; a < left.length; a += 1) for (let b = 0; b < right.length; b += 1) {
      if (segmentDistance(left[a], right[b]) <= 1.5) { leftIndices.add(a); rightIndices.add(b); }
    }
    if (leftIndices.size >= 3 && rightIndices.size >= 3) interleavedPairs += 1;
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
    closeSegmentContacts,
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
  const centers = finalFrame.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
  return centers.every(({ x }) => x >= width + margin)
    || centers.every(({ x }) => x <= -margin)
    || centers.every(({ y }) => y >= height + margin)
    || centers.every(({ y }) => y <= -margin);
}
