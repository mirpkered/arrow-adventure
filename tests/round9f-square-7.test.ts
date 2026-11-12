import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';
import { measureBoardDensity, measureComposition, measureNeighborSpacing } from '../src/game/density';
import { isBoardGridIntersection, toBoardPoint } from '../src/game/geometry';
import { analyzeLevel, nearestArrowAt, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import type { Arrow, Level } from '../src/game/types';

const prototype = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9f-square-7.json', import.meta.url), 'utf8')) as {
  id: string;
  title: string;
  contentVersion: number;
  category: string;
  board: { width: number; height: number; visibleGridSpacing: number };
  intendedRouteBands: { long: number; medium: number; short: number; definition: string };
  puzzle: Level;
};
const puzzle = prototype.puzzle;
const fingerprint = 'ef5f7d40106048add0a7b753d58213719874e3b77650dc10a711c63aa3ccd8a0';

function routeLength(arrow: Arrow): number {
  return arrow.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - arrow.path[index].x, point.y - arrow.path[index].y), 0);
}

describe('Round 9F Compact Square Weave', () => {
  it('remains a separately identified, frozen prototype outside the active catalog', () => {
    expect(prototype.id).toBe('prototype-square-7');
    expect(prototype.title).toBe('Compact Square Weave');
    expect(prototype.contentVersion).toBe(1);
    expect(prototype.category).toBe('experimental-review');
    expect(prototype.board).toEqual({ width: 7, height: 7, unit: 'cells', visibleGridSpacing: 0.5 });
    expect(puzzle.width).toBe(7);
    expect(puzzle.height).toBe(7);
    expect(puzzle.arrows).toHaveLength(15);
    expect(createHash('sha256').update(JSON.stringify(puzzle)).digest('hex')).toBe(fingerprint);
    const activeCatalog = readFileSync(new URL('../src/game/adventure-catalog.json', import.meta.url), 'utf8');
    const qaSelector = readFileSync(new URL('../src/qa/prototypeReview.ts', import.meta.url), 'utf8');
    expect(activeCatalog).not.toContain(prototype.id);
    expect(qaSelector).not.toContain(prototype.id);
    expect(JSON.parse(readFileSync(new URL('../src/game/prototypes/round9e-square-15.json', import.meta.url), 'utf8')).id)
      .toBe('prototype-square-15');
  });

  it('has 15 unique, grid-aligned orthogonal routes with the intended length mix', () => {
    expect(() => validateLevel(puzzle)).not.toThrow();
    expect(new Set(puzzle.arrows.map(({ id }) => id)).size).toBe(15);
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
        expect((dx === 0) !== (dy === 0), `${arrow.id} segment ${index - 1} is horizontal or vertical`).toBe(true);
        expect(Math.max(dx, dy), `${arrow.id} segments are one board unit`).toBe(1);
      }
    }
  });

  it('fills the square with close corridors and keeps only a small large-gap region', () => {
    const localBounds = {
      minX: Math.min(...puzzle.arrows.flatMap(({ path }) => path.map(({ x }) => x))),
      maxX: Math.max(...puzzle.arrows.flatMap(({ path }) => path.map(({ x }) => x))),
      minY: Math.min(...puzzle.arrows.flatMap(({ path }) => path.map(({ y }) => y))),
      maxY: Math.max(...puzzle.arrows.flatMap(({ path }) => path.map(({ y }) => y))),
    };
    expect(localBounds).toEqual({ minX: 0, maxX: 6.5, minY: 0, maxY: 6.5 });
    const composition = measureComposition(puzzle);
    expect(composition.totalPathLength).toBe(57);
    expect(composition.adjacentGridPathRatio).toBe(1);
    expect(composition.parallelCorridorLength).toBe(20.5);
    expect(composition.touchCompetitionPathRatio).toBe(1);
    expect(analyzeLevel(puzzle).interleavedPairs).toBe(17);

    const spacing = measureNeighborSpacing(puzzle);
    expect(spacing.minimum).toBe(0.5);
    expect(spacing.p10).toBe(0.5);
    expect(spacing.median).toBe(0.5);
    const density = measureBoardDensity(puzzle, 0.125, 1.25);
    expect(density.largeGapRatio).toBeLessThan(0.01);
    expect(density.occupancyRatio).toBeCloseTo(57 / 49, 8);
  });

  it('passes the complete reachable-state audit and agrees with gameplay on the solution', () => {
    const logic = analyzeLevel(puzzle);
    expect(logic.blockingDependencies).toBe(18);
    expect(logic.dependencyDepth).toBe(5);
    expect(logic.initiallyRemovable).toBe(7);

    const audit = auditReachableStates(puzzle);
    expect(audit.exact).toBe(true);
    expect(audit.reachableStates).toBe(1744);
    expect(audit.legalTransitions).toBe(8464);
    expect(audit.terminalStates).toBe(1);
    expect(audit.deadlocks).toEqual([]);
    expect(audit.dependencyCycles).toEqual([]);
    expect(audit.initialLegalMoves).toHaveLength(7);

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

  it('keeps paths selectable at phone scale and supports fitted zoom, pan, and reset', () => {
    for (const arrow of puzzle.arrows) {
      const segmentIndex = Math.floor((arrow.path.length - 1) / 2);
      const point = toBoardPoint({
        x: (arrow.path[segmentIndex].x + arrow.path[segmentIndex - 1].x) / 2,
        y: (arrow.path[segmentIndex].y + arrow.path[segmentIndex - 1].y) / 2,
      });
      expect(nearestArrowAt(point, puzzle.arrows)).toBe(arrow.id);
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
      const panned = camera.viewBox;
      expect(panned.x).toBeLessThan(bounds.maxX);
      expect(panned.x + panned.width).toBeGreaterThan(bounds.minX);
      expect(panned.y).toBeLessThan(bounds.maxY);
      expect(panned.y + panned.height).toBeGreaterThan(bounds.minY);
      camera.restoreFit();
      expect(camera.viewBox).toEqual(fitted);
    }
  });
});
