import { segmentDistance } from '../geometry';
import { measureFootprintDensity, measureNeighborSpacing } from '../density';
import { auditReachableStates } from '../stateAudit';
import { analyzeLevel, simulateMove, solveLevel, validateArrow, validateLevel } from '../rules';
import type { Arrow, Level, Point } from '../types';
import { pointInFootprint } from '../density';

export type CandidateOptions = {
  seed: number;
  width: number;
  height: number;
  arrowCount: number;
  polygons: Point[][];
  minSteps: number;
  maxSteps: number;
  minTurns?: number;
  maxAttempts?: number;
  maxLayouts?: number;
};

/**
 * Deterministic offline candidate aid. Its output is never used at runtime; a
 * selected result must be copied into the frozen catalog and visually reviewed.
 */
export function generateCandidate(options: CandidateOptions): Level {
  const random = seededRandom(options.seed);
  const attempts = options.maxAttempts ?? 10000;
  let failure: 'packing' | 'orientation' | 'quality' = 'packing';
  for (let layoutAttempt = 0; layoutAttempt < (options.maxLayouts ?? 16); layoutAttempt += 1) {
    const level: Level = { number: 0, width: options.width, height: options.height, arrows: [] };
    let packed = true;
    for (let arrowIndex = 0; arrowIndex < options.arrowCount; arrowIndex += 1) {
      let accepted: Arrow | undefined;
      for (let attempt = 0; attempt < attempts && !accepted; attempt += 1) {
        const path = randomWalk(options, random);
        if (!path) continue;
        const arrow = { id: `a${String(arrowIndex + 1).padStart(2, '0')}`, path };
        try { validateArrow(arrow, options.width, options.height); } catch { continue; }
        if (!hasClearance(arrow, level.arrows, 0.32)) continue;
        accepted = arrow;
      }
      if (!accepted) { packed = false; break; }
      level.arrows.push(accepted);
    }
    if (!packed) continue;

    failure = 'orientation';
    const oriented = chooseOrientation(level);
    if (!oriented) continue;
    failure = 'quality';
    level.arrows = oriented;
    try { validateLevel(level); } catch { continue; }
    const audit = auditReachableStates(level);
    if (audit.deadlocks.length || audit.dependencyCycles.length || audit.terminalStates !== 1) continue;
    const metrics = analyzeLevel(level);
    if (metrics.interleavedPairs < Math.max(2, Math.ceil(level.arrows.length * 0.35))
      || metrics.closeSegmentContacts < level.arrows.length * 5
      || Object.values(metrics.interleavedPairsByArrow).some((degree) => degree === 0)
      || metrics.dependencyDepth < 2
      || metrics.initiallyRemovable > Math.ceil(level.arrows.length * 0.6)) continue;
    if (measureFootprintDensity({ puzzle: level, footprint: options.polygons }).largeGapRatio > 0.1
      || measureNeighborSpacing(level).p90 > 1.5) continue;
    return level;
  }
  throw new Error(`Seed ${options.seed} failed ${failure} after ${options.maxLayouts ?? 16} layout attempts`);
}

function randomWalk(options: CandidateOptions, random: () => number): Point[] | undefined {
  const minimum = options.minSteps;
  const steps = minimum + Math.floor(random() * (options.maxSteps - minimum + 1));
  const lattice = (maximum: number) => {
    const points: number[] = [];
    for (let value = 0; value < maximum; value += 0.5) points.push(value);
    return points;
  };
  const possibleStarts = lattice(options.width).flatMap((x) => lattice(options.height).map((y) => ({ x, y })))
    .filter((point) => pointInFootprint(point, options.polygons));
  if (!possibleStarts.length) return undefined;
  let point = possibleStarts[Math.floor(random() * possibleStarts.length)];
  const path = [{ ...point }];
  const keys = new Set([pointKey(point)]);
  let previousDirection = -1;
  let straightCount = 0;
  const directions: Point[] = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }];
  for (let step = 0; step < steps; step += 1) {
    let choices = directions.map((direction, index) => ({ direction, index, rank: random() }))
      .sort((left, right) => left.rank - right.rank);
    if (previousDirection >= 0 && straightCount < 2 && random() < 0.6) {
      choices = choices.sort((left, right) => Number(left.index !== previousDirection) - Number(right.index !== previousDirection) || left.rank - right.rank);
    }
    let selected: { point: Point; direction: number } | undefined;
    for (const choice of choices) {
      const next = { x: point.x + choice.direction.x, y: point.y + choice.direction.y };
      if (next.x < 0 || next.y < 0 || next.x >= options.width || next.y >= options.height || keys.has(pointKey(next))) continue;
      if (!segmentInside(point, next, options.polygons)) continue;
      if (!clearOfSelf(path, next, 0.28)) continue;
      selected = { point: next, direction: choice.index };
      break;
    }
    if (!selected) return undefined;
    straightCount = selected.direction === previousDirection ? straightCount + 1 : 0;
    previousDirection = selected.direction;
    point = selected.point;
    path.push(point);
    keys.add(pointKey(point));
  }
  const turns = path.slice(2).filter((point, index) => {
    const previous = path[index + 1]; const before = path[index];
    return point.x - previous.x !== previous.x - before.x || point.y - previous.y !== previous.y - before.y;
  }).length;
  return turns >= (options.minTurns ?? 3) ? path : undefined;
}

function segmentInside(a: Point, b: Point, polygons: Point[][]): boolean {
  for (let step = 0; step <= 8; step += 1) {
    const ratio = step / 8;
    if (!pointInFootprint({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }, polygons)) return false;
  }
  return true;
}

function clearOfSelf(path: Point[], next: Point, clearance: number): boolean {
  if (path.length < 2) return true;
  const candidate = { a: path.at(-1)!, b: next };
  for (let index = 1; index < path.length - 1; index += 1) {
    if (segmentDistance(candidate, { a: path[index - 1], b: path[index] }) <= clearance) return false;
  }
  return true;
}

function hasClearance(arrow: Arrow, others: Arrow[], clearance: number): boolean {
  const segments = (path: Point[]) => path.slice(1).map((point, index) => ({ a: path[index], b: point }));
  const left = segments(arrow.path);
  return others.every((other) => left.every((a) => segments(other.path).every((b) => segmentDistance(a, b) > clearance)));
}

function chooseOrientation(level: Level): Arrow[] | undefined {
  const variants = level.arrows.map((arrow) => [arrow, { ...arrow, path: [...arrow.path].reverse() }]);
  const selfValid = variants.map((choices) => choices.map((arrow) => {
    try { validateArrow(arrow, level.width, level.height); return true; } catch { return false; }
  }));
  const count = level.arrows.length;
  const blocked = Array.from({ length: count }, () => Array.from({ length: 2 }, () => Array.from({ length: count }, () => [false, false])));
  for (let index = 0; index < count; index += 1) for (let orientation = 0; orientation < 2; orientation += 1) {
    if (!selfValid[index][orientation]) continue;
    for (let otherIndex = 0; otherIndex < count; otherIndex += 1) {
      if (index === otherIndex) continue;
      for (let otherOrientation = 0; otherOrientation < 2; otherOrientation += 1) {
        if (!selfValid[otherIndex][otherOrientation]) continue;
        blocked[index][orientation][otherIndex][otherOrientation] = !simulateMove(variants[index][orientation], [variants[otherIndex][otherOrientation]], level.width, level.height).ok;
      }
    }
  }
  for (let mask = 0; mask < 2 ** count; mask += 1) {
    const oriented = variants.map((choices, index) => choices[(mask >>> index) & 1]);
    if (oriented.some((_, index) => !selfValid[index][(mask >>> index) & 1])) continue;
    const blockersByArrow = oriented.map((_, index) => oriented.flatMap((__, otherIndex) => {
      const otherOrientation = (mask >>> otherIndex) & 1;
      return index !== otherIndex && blocked[index][(mask >>> index) & 1][otherIndex][otherOrientation] ? [otherIndex] : [];
    }));
    const initialSafe = blockersByArrow.filter((blockers) => blockers.length === 0).length;
    if (initialSafe === 0 || initialSafe > Math.ceil(count * 0.6)) continue;
    const remaining = new Set(oriented.map((_, index) => index));
    let depth = 0;
    let cycle = false;
    while (remaining.size) {
      const safe = [...remaining].filter((index) => blockersByArrow[index].every((blocker) => !remaining.has(blocker)));
      if (!safe.length) { cycle = true; break; }
      for (const index of safe) remaining.delete(index);
      depth += 1;
    }
    if (cycle || depth < 2) continue;
    const audit = auditReachableStates({ ...level, arrows: oriented });
    if (audit.deadlocks.length || audit.dependencyCycles.length || audit.terminalStates !== 1) continue;
    const report = analyzeLevel({ ...level, arrows: oriented });
    if (report.dependencyDepth < 2 || report.initiallyRemovable === 0) continue;
    if (!solveLevel({ ...level, arrows: oriented })) continue;
    return oriented;
  }
  return undefined;
}

function pointKey(point: Point): string { return `${point.x},${point.y}`; }

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
