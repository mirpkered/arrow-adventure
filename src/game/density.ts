import { pointToPolylineDistance } from './geometry';
import type { Level } from './types';

export type BoardDensity = {
  sampleStep: number;
  pathLength: number;
  occupancyRatio: number;
  areaFartherThan: number;
  largeGapRatio: number;
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
