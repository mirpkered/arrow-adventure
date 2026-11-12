import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';
import { measureBoardDensity, measureComposition, measureNeighborSpacing } from '../src/game/density';
import { isBoardGridIntersection, toBoardPoint } from '../src/game/geometry';
import { analyzeLevel, directionName, exitDirection, nearestArrowAt, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import type { Arrow, Level, Point } from '../src/game/types';

const prototype = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9g-square-7-weave.json', import.meta.url), 'utf8')) as {
  id: string;
  title: string;
  contentVersion: number;
  category: string;
  board: { width: number; height: number; unit: string; visibleGridSpacing: number };
  intendedRouteBands: { long: number; medium: number; short: number };
  puzzle: Level;
};
const puzzle = prototype.puzzle;
const fingerprint = 'cdc93584f39b2483e69294053197dd848abc2a512ae932ea7059bf2bf6b839ba';

function routeLength(arrow: Arrow): number {
  return arrow.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - arrow.path[index].x, point.y - arrow.path[index].y), 0);
}

function turns(arrow: Arrow): Array<{ at: Point; corner: string }> {
  return arrow.path.slice(1, -1).flatMap((at, index) => {
    const previous = arrow.path[index]; const next = arrow.path[index + 2];
    const before = { x: Math.sign(previous.x - at.x), y: Math.sign(previous.y - at.y) };
    const after = { x: Math.sign(next.x - at.x), y: Math.sign(next.y - at.y) };
    if (before.x === after.x || before.y === after.y) return [];
    return [{ at, corner: [JSON.stringify(before), JSON.stringify(after)].sort().join('|') }];
  });
}

function coordinatedBendPairs(arrows: Arrow[]): number {
  let pairs = 0;
  for (let left = 0; left < arrows.length; left += 1) for (let right = left + 1; right < arrows.length; right += 1) {
    const hasNeighboringBend = turns(arrows[left]).some((a) => turns(arrows[right]).some((b) =>
      a.corner === b.corner && Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) <= 1.1));
    if (hasNeighboringBend) pairs += 1;
  }
  return pairs;
}

describe('Round 9G compact interwoven square', () => {
  it('is a frozen, separately identified 7×7 prototype with exactly fifteen arrows', () => {
    expect(prototype).toMatchObject({
      id: 'prototype-square-7-weave', title: 'Compact Interwoven Square', contentVersion: 1, category: 'experimental-review',
      board: { width: 7, height: 7, unit: 'cells', visibleGridSpacing: 0.5 },
    });
    expect(puzzle).toMatchObject({ width: 7, height: 7 });
    expect(puzzle.arrows).toHaveLength(15);
    expect(new Set(puzzle.arrows.map(({ id }) => id)).size).toBe(15);
    expect(createHash('sha256').update(JSON.stringify(puzzle)).digest('hex')).toBe(fingerprint);
    expect(readFileSync(new URL('../src/game/adventure-catalog.json', import.meta.url), 'utf8')).not.toContain(prototype.id);
    expect(readFileSync(new URL('../src/qa/prototypeReview.ts', import.meta.url), 'utf8')).not.toContain(prototype.id);
  });

  it('uses only valid horizontal and vertical paths on the existing half-unit grid', () => {
    expect(() => validateLevel(puzzle)).not.toThrow();
    const lengths = puzzle.arrows.map(routeLength);
    expect(lengths).toEqual([6, 5, 5, 5, 4, 4, 4, 4, 4, 4, 3, 3, 2, 2, 2]);
    expect(lengths.filter((length) => length >= 5)).toHaveLength(prototype.intendedRouteBands.long);
    expect(lengths.filter((length) => length === 4)).toHaveLength(prototype.intendedRouteBands.medium);
    expect(lengths.filter((length) => length <= 3)).toHaveLength(prototype.intendedRouteBands.short);
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBe(57);

    for (const arrow of puzzle.arrows) {
      for (const point of arrow.path) expect(isBoardGridIntersection(toBoardPoint(point))).toBe(true);
      for (let index = 1; index < arrow.path.length; index += 1) {
        const dx = Math.abs(arrow.path[index].x - arrow.path[index - 1].x);
        const dy = Math.abs(arrow.path[index].y - arrow.path[index - 1].y);
        expect((dx === 0) !== (dy === 0), `${arrow.id} segment ${index - 1} is orthogonal`).toBe(true);
        expect(Math.max(dx, dy), `${arrow.id} segment ${index - 1} is one board unit`).toBe(1);
      }
    }
    const allX = puzzle.arrows.flatMap(({ path }) => path.map(({ x }) => x));
    const allY = puzzle.arrows.flatMap(({ path }) => path.map(({ y }) => y));
    expect({ minX: Math.min(...allX), maxX: Math.max(...allX), minY: Math.min(...allY), maxY: Math.max(...allY) })
      .toEqual({ minX: 0, maxX: 6.5, minY: 0, maxY: 6.5 });
  });

  it('improves coordinated winding while retaining close packing and varied exits', () => {
    const composition = measureComposition(puzzle);
    expect(composition.totalPathLength).toBe(57);
    expect(composition.adjacentGridPathRatio).toBeCloseTo(55 / 57, 8);
    expect(new Set(Object.keys(composition.exitDirections))).toHaveProperty('size', 4);
    expect(coordinatedBendPairs(puzzle.arrows)).toBe(10);
    expect(coordinatedBendPairs(JSON.parse(readFileSync(new URL('../src/game/prototypes/round9f-square-7.json', import.meta.url), 'utf8')).puzzle.arrows)).toBe(3);

    const spacing = measureNeighborSpacing(puzzle);
    expect(spacing.minimum).toBe(0.5);
    expect(spacing.p10).toBe(0.5);
    expect(spacing.median).toBe(0.5);
    const density = measureBoardDensity(puzzle, 0.125, 1.25);
    expect(density.largeGapRatio).toBeLessThan(0.01);
    expect(density.occupancyRatio).toBeCloseTo(57 / 49, 8);
  });

  it('passes an exact reachable-state audit and replays a complete solution in gameplay', () => {
    const analysis = analyzeLevel(puzzle);
    expect(analysis.blockingDependencies).toBe(16);
    expect(analysis.dependencyDepth).toBe(4);
    expect(analysis.initiallyRemovable).toBe(6);

    const audit = auditReachableStates(puzzle);
    expect(audit.exact).toBe(true);
    expect(audit.reachableStates).toBe(1512);
    expect(audit.legalTransitions).toBe(6684);
    expect(audit.terminalStates).toBe(1);
    expect(audit.deadlocks).toEqual([]);
    expect(audit.dependencyCycles).toEqual([]);
    expect(audit.initialLegalMoves).toHaveLength(6);

    const solution = solveLevel(puzzle);
    expect(solution).not.toBeNull();
    let remaining = puzzle.arrows.slice();
    for (const arrowId of solution!) {
      const arrow = remaining.find(({ id }) => id === arrowId)!;
      expect(simulateMove(arrow, remaining.filter(({ id }) => id !== arrow.id), puzzle.width, puzzle.height).ok).toBe(true);
      remaining = remaining.filter(({ id }) => id !== arrowId);
    }
    expect(remaining).toEqual([]);
  });

  it('keeps nearest-path selection and fitted zoom behavior at phone sizes', () => {
    for (const arrow of puzzle.arrows) {
      const segmentIndex = Math.floor((arrow.path.length - 1) / 2);
      const point = toBoardPoint({
        x: (arrow.path[segmentIndex].x + arrow.path[segmentIndex - 1].x) / 2,
        y: (arrow.path[segmentIndex].y + arrow.path[segmentIndex - 1].y) / 2,
      });
      expect(nearestArrowAt(point, puzzle.arrows)).toBe(arrow.id);
      expect(directionName(exitDirection(arrow))).toMatch(/^(north|south|east|west)$/);
    }

    const bounds = arrowCompositionBounds(puzzle.arrows)!;
    for (const [width, height] of [[320, 470], [350, 640], [390, 844], [430, 932], [844, 390]]) {
      const camera = new BoardViewport(puzzle.width, puzzle.height);
      camera.fitToContent(bounds, width, height);
      const fitted = camera.viewBox;
      expect(fitted.x).toBeLessThan(bounds.minX);
      expect(fitted.x + fitted.width).toBeGreaterThan(bounds.maxX);
      expect(fitted.y).toBeLessThan(bounds.minY);
      expect(fitted.y + fitted.height).toBeGreaterThan(bounds.maxY);
      camera.zoomAt(2, { x: fitted.x + fitted.width / 2, y: fitted.y + fitted.height / 2 });
      expect(camera.scale).toBeCloseTo(2, 8);
      camera.panBy(1000, 1000);
      expect(camera.viewBox.x).toBeLessThan(bounds.maxX);
      expect(camera.viewBox.x + camera.viewBox.width).toBeGreaterThan(bounds.minX);
      camera.restoreFit();
      expect(camera.viewBox).toEqual(fitted);
    }
  });
});
