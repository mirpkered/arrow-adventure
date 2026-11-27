import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';
import { measureComposition, measureFootprintDensity, measureNeighborSpacing } from '../src/game/density';
import { analyzeLevel, nearestArrowAt, simulateMove, solveLevel, TOUCH_PICK_RADIUS, validateLevel } from '../src/game/rules';
import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel, validateCuratedLevels } from '../src/game/catalog';
import { auditReachableStates } from '../src/game/stateAudit';

const entry = CURATED_LEVELS[5];
const expectedRouteLengths = [1, 8, 7, 6, 5, 1, 5, 7, 8, 8, 1, 7, 3, 2, 8, 7, 4, 8, 2, 3];

describe('Round 13 larger Adventure Mode content', () => {
  it('adds a frozen, deterministic true-grid Level 6 without changing the opening five', () => {
    expect(CURATED_LEVELS).toHaveLength(6);
    expect([entry.id, entry.number, entry.authoringSeed, entry.contentVersion]).toEqual(['first-flight-006', 6, 13309, 1]);
    const { puzzle } = entry;
    expect([puzzle.width, puzzle.height, puzzle.arrows.length]).toEqual([10, 10, 20]);
    expect(puzzle.grid).toEqual({ spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true });
    expect(new Set(puzzle.arrows.map(({ id }) => id)).size).toBe(puzzle.arrows.length);
    for (const arrow of puzzle.arrows) for (let index = 0; index < arrow.path.length; index += 1) {
      const point = arrow.path[index];
      expect(Number.isInteger(point.x) && Number.isInteger(point.y), `${entry.id}/${arrow.id}`).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(puzzle.width);
      expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(puzzle.height);
      if (index) {
        const dx = Math.abs(point.x - arrow.path[index - 1].x); const dy = Math.abs(point.y - arrow.path[index - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
        expect(Math.max(dx, dy)).toBe(1);
      }
    }
    expect(puzzle.arrows.map(({ path }) => path.length - 1)).toEqual(expectedRouteLengths);
    expect(() => validateLevel(puzzle)).not.toThrow();
    expect(getCuratedLevel(6)?.id).toBe('first-flight-006');
    expect(getNextCuratedLevel(CURATED_LEVELS[4])?.id).toBe('first-flight-006');
    expect(getNextCuratedLevel(entry)).toBeUndefined();
    expect(() => validateCuratedLevels()).not.toThrow();
  });

  it('exhaustively audits Level 6 and replays its full solution through the gameplay simulator', () => {
    const { puzzle } = entry;
    const exact = auditReachableStates(puzzle);
    expect(exact).toMatchObject({ exact: true, reachableStates: 2206, legalTransitions: 9163, terminalStates: 1, deadlocks: [], dependencyCycles: [] });
    const solution = solveLevel(puzzle);
    expect(solution).not.toBeNull();
    let remaining = [...puzzle.arrows];
    for (const id of solution!) {
      const moving = remaining.find(({ id: candidate }) => candidate === id)!;
      const stationary = remaining.filter(({ id: candidate }) => candidate !== id);
      expect(simulateMove(moving, stationary, puzzle.width, puzzle.height, puzzle.grid).ok, id).toBe(true);
      remaining = stationary;
    }
    expect(remaining).toEqual([]);
  });

  it('measures full-board occupancy, variety, dependencies, and close-path selection', () => {
    const { puzzle } = entry;
    const metrics = analyzeLevel(puzzle);
    expect(metrics.pathLengths.reduce((sum, length) => sum + length, 0)).toBe(101);
    expect(metrics.interleavedPairs).toBe(17);
    expect(metrics.closeSegmentContacts).toBe(317);
    expect(metrics.blockingDependencies).toBe(31);
    expect(metrics.dependencyDepth).toBe(5);
    expect(metrics.initiallyRemovable).toBe(5);
    expect(Object.entries(metrics.interleavedPairsByArrow).filter(([id, degree]) => degree === 0 && metrics.blockersByArrow[id] === 0)).toEqual([]);
    expect(measureComposition(puzzle, 1.01).adjacentGridPathRatio).toBeCloseTo(0.9801980198019802, 6);
    expect(measureNeighborSpacing(puzzle).p10).toBe(1);
    expect(measureFootprintDensity(entry).largeGapRatio).toBe(0);
    for (const arrow of puzzle.arrows) {
      const point = { x: (arrow.path[0].x + arrow.path[1].x) / 2, y: (arrow.path[0].y + arrow.path[1].y) / 2 };
      expect(nearestArrowAt(point, puzzle.arrows, TOUCH_PICK_RADIUS, 0), arrow.id).toBe(arrow.id);
    }
  });

  it('fits the 10×10 board at phone and desktop viewports with zoom reset preserved', () => {
    const viewports = [
      { screen: [320, 568], play: [320, 396] },
      { screen: [390, 844], play: [390, 622] },
      { screen: [430, 932], play: [430, 710] },
      { screen: [1280, 800], play: [1136, 690] },
    ] as const;
    for (const viewportSize of viewports) {
      const bounds = arrowCompositionBounds(entry.puzzle.arrows, entry.puzzle.grid!.pathOffset)!;
      const viewport = new BoardViewport(entry.puzzle.width, entry.puzzle.height);
      viewport.fitToContent(bounds, viewportSize.play[0], viewportSize.play[1]);
      const fitted = viewport.viewBox;
      expect(fitted.x).toBeLessThan(bounds.minX); expect(fitted.y).toBeLessThan(bounds.minY);
      expect(fitted.x + fitted.width).toBeGreaterThan(bounds.maxX); expect(fitted.y + fitted.height).toBeGreaterThan(bounds.maxY);
      viewport.zoomAt(2.5, { x: 0, y: 0 }); viewport.restoreFit();
      expect(viewport.viewBox).toEqual(fitted);
    }
  });
});
