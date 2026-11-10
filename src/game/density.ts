import { pointToPolylineDistance, segmentDistance } from './geometry';
import { directionName, exitDirection } from './rules';
import type { CuratedLevel, Level, Point } from './types';

export type BoardDensity = {
  sampleStep: number;
  pathLength: number;
  occupancyRatio: number;
  areaFartherThan: number;
  largeGapRatio: number;
};

export type FootprintDensity = BoardDensity & {
  footprintArea: number;
  pathLengthInside: number;
  internalGapSamples: number;
  sampleCount: number;
};

export type NeighborSpacing = { minimum: number; p10: number; median: number; p90: number; samples: number };
export type CompositionMetrics = {
  totalPathLength: number;
  adjacentGridPathRatio: number;
  parallelCorridorLength: number;
  routeLengthBands: { short: number; medium: number; long: number };
  exitDirections: Record<string, number>;
  touchCompetitionPathRatio: number;
};

/** Measures sampled whitespace and route occupancy without treating overlap of bounds as interleaving. */
export function measureBoardDensity(level: Level, sampleStep = 0.25, gapDistance = 1.5): BoardDensity {
  if (!Number.isFinite(sampleStep) || sampleStep <= 0 || !Number.isFinite(gapDistance) || gapDistance < 0) {
    throw new Error('Density sampling requires a positive sample step and nonnegative gap distance');
  }
  const pathLength = level.arrows.reduce((total, arrow) => total + arrow.path.slice(1).reduce((length, point, index) =>
    length + Math.hypot(point.x - arrow.path[index].x, point.y - arrow.path[index].y), 0), 0);
  let samples = 0;
  let largeGapSamples = 0;
  const halfStep = sampleStep / 2;
  for (let y = halfStep; y < level.height; y += sampleStep) for (let x = halfStep; x < level.width; x += sampleStep) {
    samples += 1;
    const point = { x, y };
    const nearest = Math.min(...level.arrows.map((arrow) => pointToPolylineDistance(point, arrow.path)));
    if (nearest > gapDistance) largeGapSamples += 1;
  }
  const boardArea = level.width * level.height;
  return {
    sampleStep,
    pathLength,
    occupancyRatio: pathLength / boardArea,
    areaFartherThan: gapDistance,
    largeGapRatio: samples ? largeGapSamples / samples : 1,
  };
}

/**
 * Measures sampled whitespace only inside the explicitly authored intended footprint.
 * Polygon vertices use the same path-local coordinate frame as arrow definitions.
 */
export function measureFootprintDensity(entry: Pick<CuratedLevel, 'puzzle' | 'footprint'>, sampleStep = 0.25, gapDistance = 1.5): FootprintDensity {
  if (!Number.isFinite(sampleStep) || sampleStep <= 0 || !Number.isFinite(gapDistance) || gapDistance < 0) {
    throw new Error('Footprint sampling requires a positive sample step and nonnegative gap distance');
  }
  const { puzzle, footprint } = entry;
  if (!footprint.length || footprint.some((polygon) => polygon.length < 3)) throw new Error('A level footprint needs at least one polygon with three vertices');
  const halfStep = sampleStep / 2;
  let samples = 0;
  let largeGapSamples = 0;
  let pathLengthInside = 0;
  for (let y = halfStep; y < puzzle.height; y += sampleStep) for (let x = halfStep; x < puzzle.width; x += sampleStep) {
    if (!pointInFootprint({ x, y }, footprint)) continue;
    samples += 1;
    const nearest = Math.min(...puzzle.arrows.map((arrow) => pointToPolylineDistance({ x, y }, arrow.path)));
    if (nearest > gapDistance) largeGapSamples += 1;
  }
  for (const arrow of puzzle.arrows) for (let index = 1; index < arrow.path.length; index += 1) {
    const a = arrow.path[index - 1]; const b = arrow.path[index];
    const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (sampleStep / 2)));
    for (let step = 0; step < steps; step += 1) {
      const ratio = (step + 0.5) / steps;
      if (pointInFootprint({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }, footprint)) {
        pathLengthInside += Math.hypot(b.x - a.x, b.y - a.y) / steps;
      }
    }
  }
  const footprintArea = samples * sampleStep * sampleStep;
  return {
    sampleStep,
    pathLength: puzzle.arrows.reduce((sum, arrow) => sum + arrow.path.slice(1).reduce((length, point, index) => length + Math.hypot(point.x - arrow.path[index].x, point.y - arrow.path[index].y), 0), 0),
    occupancyRatio: footprintArea ? pathLengthInside / footprintArea : 0,
    areaFartherThan: gapDistance,
    largeGapRatio: samples ? largeGapSamples / samples : 1,
    footprintArea,
    pathLengthInside,
    internalGapSamples: largeGapSamples,
    sampleCount: samples,
  };
}

/** Per-segment closest distances to a different arrow; useful for assessing both packing and selection. */
export function measureNeighborSpacing(level: Level): NeighborSpacing {
  const samples: number[] = [];
  for (let index = 0; index < level.arrows.length; index += 1) {
    const arrow = level.arrows[index];
    const others = level.arrows.filter((_, otherIndex) => otherIndex !== index);
    if (!others.length) continue;
    for (let segmentIndex = 1; segmentIndex < arrow.path.length; segmentIndex += 1) {
      const segment = { a: arrow.path[segmentIndex - 1], b: arrow.path[segmentIndex] };
      let nearest = Infinity;
      for (const other of others) for (let otherSegment = 1; otherSegment < other.path.length; otherSegment += 1) {
        nearest = Math.min(nearest, segmentDistance(segment, { a: other.path[otherSegment - 1], b: other.path[otherSegment] }));
      }
      if (Number.isFinite(nearest)) samples.push(nearest);
    }
  }
  samples.sort((a, b) => a - b);
  const percentile = (p: number) => samples.length ? samples[Math.min(samples.length - 1, Math.floor((samples.length - 1) * p))] : Infinity;
  return { minimum: samples[0] ?? Infinity, p10: percentile(0.1), median: percentile(0.5), p90: percentile(0.9), samples: samples.length };
}

/**
 * Measures how often distinct paths share a neighboring grid corridor. The
 * default 0.75 distance includes a 0.5-grid adjacent line and a 45-degree
 * neighbor (sqrt(0.5²+0.5²)); this is descriptive, not a collision rule.
 */
export function measureComposition(level: Level): CompositionMetrics {
  const segmentsByArrow = level.arrows.map((arrow) => arrow.path.slice(1).map((point, index) => ({
    a: arrow.path[index], b: point,
    length: Math.hypot(point.x - arrow.path[index].x, point.y - arrow.path[index].y),
  })));
  const routeLengths = level.arrows.map((arrow) => arrow.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - arrow.path[index].x, point.y - arrow.path[index].y), 0));
  const totalPathLength = routeLengths.reduce((sum, length) => sum + length, 0);
  const routeLengthBands = {
    short: routeLengths.filter((length) => length <= 4).length,
    medium: routeLengths.filter((length) => length > 4 && length <= 14).length,
    long: routeLengths.filter((length) => length > 14).length,
  };
  const exitDirections: Record<string, number> = {};
  for (const arrow of level.arrows) {
    const direction = directionName(exitDirection(arrow));
    exitDirections[direction] = (exitDirections[direction] ?? 0) + 1;
  }

  let adjacentPathLength = 0;
  let competingPathLength = 0;
  let parallelCorridorLength = 0;
  for (let arrowIndex = 0; arrowIndex < level.arrows.length; arrowIndex += 1) {
    const own = segmentsByArrow[arrowIndex];
    const others = segmentsByArrow.filter((_, index) => index !== arrowIndex);
    for (const segment of own) {
      let nearest = Infinity;
      for (const otherArrow of others) for (const other of otherArrow) {
        const distance = segmentDistance(segment, other);
        nearest = Math.min(nearest, distance);
        if (distance <= 0.75 && parallelOverlapLength(segment, other) > 0) {
          parallelCorridorLength += parallelOverlapLength(segment, other);
        }
      }
      if (nearest <= 0.75) adjacentPathLength += segment.length;
      if (nearest <= 1.5) competingPathLength += segment.length;
    }
  }
  return {
    totalPathLength,
    adjacentGridPathRatio: totalPathLength ? adjacentPathLength / totalPathLength : 0,
    parallelCorridorLength: parallelCorridorLength / 2,
    routeLengthBands,
    exitDirections,
    touchCompetitionPathRatio: totalPathLength ? competingPathLength / totalPathLength : 0,
  };
}

function parallelOverlapLength(left: {a: Point; b: Point}, right: {a: Point; b: Point}): number {
  const lx = left.b.x - left.a.x; const ly = left.b.y - left.a.y;
  const rx = right.b.x - right.a.x; const ry = right.b.y - right.a.y;
  const leftLength = Math.hypot(lx, ly); const rightLength = Math.hypot(rx, ry);
  if (!leftLength || !rightLength || Math.abs(lx * ry - ly * rx) / (leftLength * rightLength) > 1e-8) return 0;
  const ux = lx / leftLength; const uy = ly / leftLength;
  const first = (right.a.x - left.a.x) * ux + (right.a.y - left.a.y) * uy;
  const second = (right.b.x - left.a.x) * ux + (right.b.y - left.a.y) * uy;
  return Math.max(0, Math.min(leftLength, Math.max(first, second)) - Math.max(0, Math.min(first, second)));
}

/** A compact authoring heatmap: # inside the silhouette, ! for an unintended large gap, · for covered cells. */
export function footprintHeatmap(entry: Pick<CuratedLevel, 'puzzle' | 'footprint'>, sampleStep = 0.5, gapDistance = 1.5): string {
  const rows: string[] = [];
  for (let y = sampleStep / 2; y < entry.puzzle.height; y += sampleStep) {
    let row = '';
    for (let x = sampleStep / 2; x < entry.puzzle.width; x += sampleStep) {
      if (!pointInFootprint({ x, y }, entry.footprint)) row += ' ';
      else if (Math.min(...entry.puzzle.arrows.map((arrow) => pointToPolylineDistance({ x, y }, arrow.path))) > gapDistance) row += '!';
      else row += '#';
    }
    rows.push(row.trimEnd());
  }
  return rows.join('\n');
}

export function pointInFootprint(point: Point, polygons: Point[][]): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
    const closestX = a.x + t * dx; const closestY = a.y + t * dy;
    if (Math.hypot(point.x - closestX, point.y - closestY) <= 1e-9) return true;
    const cross = (a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (cross) inside = !inside;
  }
  return inside;
}
