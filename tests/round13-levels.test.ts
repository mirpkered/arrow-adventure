import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';
import { measureComposition, measureFootprintDensity, measureNeighborSpacing } from '../src/game/density';
import { analyzeLevel, nearestArrowAt, simulateMove, solveLevel, TOUCH_PICK_RADIUS, validateLevel } from '../src/game/rules';
import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel, validateCuratedLevels } from '../src/game/catalog';
import { auditBlockerGraph, auditReachableStates } from '../src/game/stateAudit';

const largeLevels = CURATED_LEVELS.slice(5);
const expectedRouteLengths = [
  [1, 8, 7, 6, 5, 1, 5, 7, 8, 8, 1, 7, 3, 2, 8, 7, 4, 8, 2, 3],
  [1, 7, 4, 3, 3, 3, 3, 7, 5, 7, 3, 2, 3, 7, 6, 7, 2, 6, 6, 1, 4, 5, 7, 3, 7, 6, 6, 5, 7, 3],
  [6, 3, 3, 3, 1, 5, 5, 1, 1, 3, 7, 5, 5, 1, 5, 7, 3, 7, 5, 4, 6, 7, 4, 4, 5, 3, 6, 7, 4, 3, 6, 7, 7, 6, 4, 5, 7, 5, 6, 3],
];

describe('Round 13 larger Adventure Mode content', () => {
  it('adds frozen, deterministic true-grid Levels 6 through 8 without changing the opening five', () => {
    expect(CURATED_LEVELS).toHaveLength(8);
    expect(largeLevels.map(({ id, number, authoringSeed, contentVersion }) => [id, number, authoringSeed, contentVersion])).toEqual([
      ['first-flight-006', 6, 13309, 1], ['first-flight-007', 7, 14825, 1], ['first-flight-008', 8, 17727, 1],
    ]);
    expect(largeLevels.map(({ puzzle }) => [puzzle.width, puzzle.height, puzzle.arrows.length])).toEqual([[10, 10, 20], [12, 12, 30], [14, 14, 40]]);
    for (const [levelIndex, entry] of largeLevels.entries()) {
      const { puzzle } = entry;
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
      expect(puzzle.arrows.map(({ path }) => path.length - 1)).toEqual(expectedRouteLengths[levelIndex]);
      expect(() => validateLevel(puzzle), entry.id).not.toThrow();
    }
    expect(getCuratedLevel(6)?.id).toBe('first-flight-006');
    expect(getCuratedLevel(8)?.id).toBe('first-flight-008');
    expect(getNextCuratedLevel(CURATED_LEVELS[4])?.id).toBe('first-flight-006');
    expect(getNextCuratedLevel(CURATED_LEVELS[5])?.id).toBe('first-flight-007');
    expect(getNextCuratedLevel(CURATED_LEVELS[6])?.id).toBe('first-flight-008');
    expect(getNextCuratedLevel(CURATED_LEVELS[7])).toBeUndefined();
    expect(() => validateCuratedLevels()).not.toThrow();
  });

  it('exhaustively audits Level 6 and uses complete graph proofs plus simulator replay above the exact cap', () => {
    const level6 = CURATED_LEVELS[5].puzzle;
    const exact = auditReachableStates(level6);
    expect(exact).toMatchObject({ exact: true, reachableStates: 2206, legalTransitions: 9163, terminalStates: 1, deadlocks: [], dependencyCycles: [] });

    for (const [levelIndex, entry] of largeLevels.slice(1).entries()) {
      const puzzle = entry.puzzle;
      const graph = auditBlockerGraph(puzzle);
      expect(graph).toMatchObject({ method: 'static-blocker-dag', stateEnumeration: false, completeGuarantee: true,
        arrowCount: levelIndex === 0 ? 30 : 40, blockerEdges: levelIndex === 0 ? 66 : 95,
        dependencyCycles: [] });
      expect(graph.initialLegalMoves).toEqual(levelIndex === 0
        ? ['g02', 'g04', 'g05', 'g29']
        : ['g02', 'g05', 'g06', 'g07', 'g15', 'g25', 'g35', 'g37', 'g38']);
      expect(graph.removalSequence).toHaveLength(puzzle.arrows.length);
      expect(() => auditReachableStates(puzzle)).toThrow(/bounded to 20 arrows/i);

      const solution = solveLevel(puzzle);
      expect(solution).not.toBeNull();
      let remaining = [...puzzle.arrows];
      for (const id of solution!) {
        const moving = remaining.find(({ id: candidate }) => candidate === id)!;
        const stationary = remaining.filter(({ id: candidate }) => candidate !== id);
        expect(simulateMove(moving, stationary, puzzle.width, puzzle.height, puzzle.grid).ok, `${entry.id}/${id}`).toBe(true);
        remaining = stationary;
      }
      expect(remaining).toEqual([]);
    }
  });

  it('measures full-board occupancy, path variety, dependencies, and close-path selection', () => {
    const expectations = [
      { routeUnits: 101, interleaved: 17, contacts: 317, edges: 31, depth: 5, opening: 5, coverage: 0.9801980198019802 },
      { routeUnits: 139, interleaved: 24, contacts: 461, edges: 66, depth: 7, opening: 4, coverage: 0.9856115107913669 },
      { routeUnits: 185, interleaved: 36, contacts: 629, edges: 95, depth: 11, opening: 9, coverage: 0.9945945945945946 },
    ];
    largeLevels.forEach((entry, index) => {
      const { puzzle } = entry; const expected = expectations[index];
      const metrics = analyzeLevel(puzzle);
      expect(metrics.pathLengths.reduce((sum, length) => sum + length, 0)).toBe(expected.routeUnits);
      expect(metrics.interleavedPairs).toBe(expected.interleaved);
      expect(metrics.closeSegmentContacts).toBe(expected.contacts);
      expect(metrics.blockingDependencies).toBe(expected.edges);
      expect(metrics.dependencyDepth).toBe(expected.depth);
      expect(metrics.initiallyRemovable).toBe(expected.opening);
      const isolated = Object.entries(metrics.interleavedPairsByArrow)
        .filter(([id, degree]) => degree === 0 && metrics.blockersByArrow[id] === 0);
      expect(isolated.map(([id]) => id)).toEqual(entry.number === 8 ? ['g05'] : []);
      expect(measureComposition(puzzle, 1.01).adjacentGridPathRatio).toBeCloseTo(expected.coverage, 6);
      expect(measureNeighborSpacing(puzzle).p10).toBe(1);
      expect(measureFootprintDensity(entry).largeGapRatio).toBe(0);
      for (const arrow of puzzle.arrows) {
        const point = { x: (arrow.path[0].x + arrow.path[1].x) / 2, y: (arrow.path[0].y + arrow.path[1].y) / 2 };
        expect(nearestArrowAt(point, puzzle.arrows, TOUCH_PICK_RADIUS, 0), `${entry.id}/${arrow.id}`).toBe(arrow.id);
      }
    });
  });

  it('fits both boards without clipping at portrait phones and desktop viewports, with zoom reset preserved', () => {
    const viewports = [
      { screen: [320, 568], play: [320, 396] },
      { screen: [390, 844], play: [390, 622] },
      { screen: [430, 932], play: [430, 710] },
      { screen: [1280, 800], play: [1136, 690] },
    ] as const;
    for (const entry of largeLevels) for (const viewportSize of viewports) {
      const bounds = arrowCompositionBounds(entry.puzzle.arrows, entry.puzzle.grid!.pathOffset)!;
      const viewport = new BoardViewport(entry.puzzle.width, entry.puzzle.height);
      viewport.fitToContent(bounds, viewportSize.play[0], viewportSize.play[1]);
      const fitted = viewport.viewBox;
      expect(fitted.x).toBeLessThan(bounds.minX);
      expect(fitted.y).toBeLessThan(bounds.minY);
      expect(fitted.x + fitted.width).toBeGreaterThan(bounds.maxX);
      expect(fitted.y + fitted.height).toBeGreaterThan(bounds.maxY);
      viewport.zoomAt(2.5, { x: 0, y: 0 });
      viewport.restoreFit();
      expect(viewport.viewBox).toEqual(fitted);
    }
  });
});
