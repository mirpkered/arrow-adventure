import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';
import { measureBoardDensity, measureComposition, measureNeighborSpacing } from '../src/game/density';
import { isBoardGridIntersection, toBoardPoint } from '../src/game/geometry';
import { nearestArrowAt, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import type { Level } from '../src/game/types';

const prototype = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9e-square-15.json', import.meta.url), 'utf8')) as {
  id: string; title: string; contentVersion: number; category: string; board: { width: number; height: number; visibleGridSpacing: number };
  intendedRouteBands: { long: number; medium: number; short: number }; puzzle: Level;
};
const puzzle = prototype.puzzle;

describe('Round 9E Square Weave prototype', () => {
  it('remains a single frozen experimental composition outside Adventure and QA catalogs', () => {
    expect(prototype.id).toBe('prototype-square-15');
    expect(prototype.contentVersion).toBe(1);
    expect(prototype.category).toBe('experimental-review');
    expect(prototype.intendedRouteBands).toEqual({ long: 4, medium: 6, short: 5 });
    expect(puzzle.width).toBe(15);
    expect(puzzle.height).toBe(15);
    expect(puzzle.arrows).toHaveLength(15);
    const activeCatalog = JSON.stringify(JSON.parse(readFileSync(new URL('../src/game/adventure-catalog.json', import.meta.url), 'utf8')));
    const qaSelector = readFileSync(new URL('../src/qa/prototypeReview.ts', import.meta.url), 'utf8');
    expect(activeCatalog).not.toContain(prototype.id);
    expect(qaSelector).not.toContain(prototype.id);
    expect(createHash('sha256').update(JSON.stringify(puzzle)).digest('hex'))
      .toBe('0551c66eeacbcc180a738caf71d180fce31eb58545b3cf6f431ff1e8c4f092ba');
  });

  it('uses legal grid-aligned orthogonal paths with the requested length mix', () => {
    expect(() => validateLevel(puzzle)).not.toThrow();
    const bands = measureComposition(puzzle).routeLengthBands;
    expect(bands).toEqual({ short: 5, medium: 6, long: 4 });
    expect(bands).toEqual({ short: prototype.intendedRouteBands.short, medium: prototype.intendedRouteBands.medium, long: prototype.intendedRouteBands.long });
    for (const arrow of puzzle.arrows) {
      for (const point of arrow.path) expect(isBoardGridIntersection(toBoardPoint(point))).toBe(true);
      for (let index = 1; index < arrow.path.length; index += 1) {
        const dx = Math.abs(arrow.path[index].x - arrow.path[index - 1].x);
        const dy = Math.abs(arrow.path[index].y - arrow.path[index - 1].y);
        expect((dx === 0) !== (dy === 0), `${arrow.id} segment ${index - 1} is orthogonal`).toBe(true);
        expect(Math.max(dx, dy)).toBe(1);
      }
    }
  });

  it('keeps all occupied edges inside a square footprint with little large-gap area', () => {
    expect(Math.min(...puzzle.arrows.flatMap(({ path }) => path.map(({ x }) => x)))).toBe(0);
    expect(Math.max(...puzzle.arrows.flatMap(({ path }) => path.map(({ x }) => x)))).toBe(14.5);
    expect(Math.min(...puzzle.arrows.flatMap(({ path }) => path.map(({ y }) => y)))).toBe(0.5);
    expect(Math.max(...puzzle.arrows.flatMap(({ path }) => path.map(({ y }) => y)))).toBe(14.5);
    const density = measureBoardDensity(puzzle, 0.25, 1.5);
    expect(density.pathLength).toBe(138);
    expect(density.occupancyRatio).toBeCloseTo(138 / 225, 8);
    expect(density.largeGapRatio).toBeLessThan(0.08);
  });

  it('packs neighboring corridors while preserving a playable dependency structure', () => {
    const composition = measureComposition(puzzle);
    const spacing = measureNeighborSpacing(puzzle);
    expect(composition.adjacentGridPathRatio).toBeGreaterThan(0.7);
    expect(composition.parallelCorridorLength).toBeGreaterThan(15);
    expect(composition.touchCompetitionPathRatio).toBeGreaterThan(0.95);
    expect(spacing.minimum).toBe(0.5);
    expect(spacing.p10).toBe(0.5);
    expect(spacing.median).toBe(0.5);
  });

  it('passes a complete reachable-state audit and agrees with gameplay on every solution move', () => {
    const audit = auditReachableStates(puzzle);
    expect(audit.exact).toBe(true);
    expect(audit.reachableStates).toBe(286);
    expect(audit.legalTransitions).toBe(921);
    expect(audit.terminalStates).toBe(1);
    expect(audit.deadlocks).toEqual([]);
    expect(audit.dependencyCycles).toEqual([]);
    expect(audit.initialLegalMoves).toHaveLength(3);

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

  it('keeps every arrow selectable at its own centerline and fits the full geometry on phone viewports', () => {
    for (const arrow of puzzle.arrows) {
      const index = Math.floor((arrow.path.length - 1) / 2);
      const point = toBoardPoint({
        x: (arrow.path[index].x + arrow.path[index - 1].x) / 2,
        y: (arrow.path[index].y + arrow.path[index - 1].y) / 2,
      });
      expect(nearestArrowAt(point, puzzle.arrows)).toBe(arrow.id);
    }

    const bounds = arrowCompositionBounds(puzzle.arrows)!;
    for (const [width, height] of [[320, 470], [350, 640], [390, 650], [430, 740], [844, 300]]) {
      const camera = new BoardViewport(puzzle.width, puzzle.height);
      camera.fitToContent(bounds, width, height);
      const view = camera.viewBox;
      expect(view.x).toBeLessThan(bounds.minX);
      expect(view.x + view.width).toBeGreaterThan(bounds.maxX);
      expect(view.y).toBeLessThan(bounds.minY);
      expect(view.y + view.height).toBeGreaterThan(bounds.maxY);
    }
  });
});
