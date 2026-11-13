import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';
import { boardGridMarkup } from '../src/app/boardGrid';
import { measureBoardDensity, measureComposition, measureNeighborSpacing } from '../src/game/density';
import { isBoardGridIntersection, LEGACY_GRID_SPECIFICATION, toBoardPoint } from '../src/game/geometry';
import { analyzeLevel, directionName, exitDirection, nearestArrowAt, simulateMove, solveLevel, validateArrow, validateLevel } from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import type { Arrow, GridSpecification, Level } from '../src/game/types';

const prototype = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9h-square-true-7.json', import.meta.url), 'utf8')) as {
  id: string;
  title: string;
  contentVersion: number;
  category: string;
  puzzleFingerprintSha256: string;
  board: { width: number; height: number; unit: string; visibleGridSpacing: number; intersectionPositionsPerAxis: number };
  intendedRouteBands: { long: number; medium: number; short: number };
  puzzle: Level;
};
const puzzle = prototype.puzzle;
const grid: GridSpecification = { spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true };
const expectedFingerprint = '7d48e27bbb9a7d4212eefc5548549f9bd227eed0eb0d7111dac4c1341629ac8a';

function routeLength(arrow: Arrow): number {
  return arrow.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - arrow.path[index].x, point.y - arrow.path[index].y), 0);
}

function coordinatedBendPairs(arrows: Arrow[], radius: number): number {
  const turns = (arrow: Arrow) => arrow.path.slice(1, -1).flatMap((point, index) => {
    const before = { x: Math.sign(arrow.path[index].x - point.x), y: Math.sign(arrow.path[index].y - point.y) };
    const after = { x: Math.sign(arrow.path[index + 2].x - point.x), y: Math.sign(arrow.path[index + 2].y - point.y) };
    if (before.x === after.x || before.y === after.y) return [];
    return [{ point, corner: [JSON.stringify(before), JSON.stringify(after)].sort().join('|') }];
  });
  let pairs = 0;
  for (let left = 0; left < arrows.length; left += 1) for (let right = 0; right < left; right += 1) {
    if (turns(arrows[left]).some((a) => turns(arrows[right]).some((b) => a.corner === b.corner
      && Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) <= radius))) pairs += 1;
  }
  return pairs;
}

describe('Round 9H true 7×7 visible grid prototype', () => {
  it('is frozen, separate from Adventure Mode, and registered in QA review', () => {
    expect(prototype).toMatchObject({
      id: 'prototype-square-true-7', title: 'True-Grid Interwoven Square', contentVersion: 1, category: 'experimental-review',
      board: { width: 7, height: 7, unit: 'cells', visibleGridSpacing: 1, intersectionPositionsPerAxis: 8 },
      intendedRouteBands: { long: 4, medium: 6, short: 5 },
    });
    expect(puzzle).toMatchObject({ width: 7, height: 7, grid });
    expect(puzzle.arrows).toHaveLength(15);
    expect(new Set(puzzle.arrows.map(({ id }) => id)).size).toBe(15);
    const fingerprint = createHash('sha256').update(JSON.stringify(puzzle)).digest('hex');
    expect(fingerprint).toBe(expectedFingerprint);
    expect(prototype.puzzleFingerprintSha256).toBe(expectedFingerprint);
    expect(readFileSync(new URL('../src/game/adventure-catalog.json', import.meta.url), 'utf8')).not.toContain(prototype.id);
    expect(readFileSync(new URL('../src/qa/prototypeReview.ts', import.meta.url), 'utf8')).toContain('round9h-square-true-7.json');
  });

  it('renders exactly eight intersection lines per axis and rejects hidden half-step routing', () => {
    const markup = boardGridMarkup(7, 7, false, grid);
    const majorPath = markup.match(/<path class="grid-major [^"]*" d="([^"]*)" \/>/)?.[1];
    const finePath = markup.match(/<path class="grid-fine" d="([^"]*)" \/>/)?.[1];
    expect(majorPath).toBeDefined();
    expect(finePath).toBe('');
    const commands = majorPath!.match(/M /g) ?? [];
    expect(commands).toHaveLength(16);
    expect(majorPath!.match(/ V /g) ?? []).toHaveLength(8);
    expect(majorPath!.match(/ H /g) ?? []).toHaveLength(8);
    const xLines = [...majorPath!.matchAll(/M (-?\d+(?:\.\d+)?) \S+ V /g)].map((match) => Number(match[1]));
    const yLines = [...majorPath!.matchAll(/M \S+ (-?\d+(?:\.\d+)?) H /g)].map((match) => Number(match[1]));
    expect(xLines).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(yLines).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(xLines.slice(1).map((value, index) => value - xLines[index])).toEqual(Array(7).fill(1));
    expect(yLines.slice(1).map((value, index) => value - yLines[index])).toEqual(Array(7).fill(1));

    expect(() => validateLevel(puzzle)).not.toThrow();
    for (const arrow of puzzle.arrows) {
      for (const point of arrow.path) {
        const visiblePoint = toBoardPoint(point, grid.pathOffset);
        expect(visiblePoint).toEqual(point);
        expect(isBoardGridIntersection(visiblePoint, grid.spacing, grid.origin)).toBe(true);
        expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(7);
        expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(7);
      }
      for (let index = 1; index < arrow.path.length; index += 1) {
        const dx = Math.abs(arrow.path[index].x - arrow.path[index - 1].x);
        const dy = Math.abs(arrow.path[index].y - arrow.path[index - 1].y);
        expect((dx === 0) !== (dy === 0), `${arrow.id} segment ${index - 1} must be horizontal or vertical`).toBe(true);
        expect(Math.max(dx, dy), `${arrow.id} segment ${index - 1} must connect adjacent visible intersections`).toBe(1);
      }
    }
    const halfStepArrow = structuredClone(puzzle.arrows[0]);
    halfStepArrow.path[0].x += 0.5;
    expect(() => validateArrow(halfStepArrow, 7, 7, 1, grid)).toThrow(/not on the 1-unit board grid/i);
  });

  it('preserves the old Round 9F and 9G grid interpretations and frozen content', () => {
    const round9f = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9f-square-7.json', import.meta.url), 'utf8'));
    const round9g = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9g-square-7-weave.json', import.meta.url), 'utf8'));
    expect(round9f.board.visibleGridSpacing).toBe(0.5);
    expect(round9g.board.visibleGridSpacing).toBe(0.5);
    expect(round9f.puzzle.grid).toBeUndefined();
    expect(round9g.puzzle.grid).toBeUndefined();
    expect(boardGridMarkup(7, 7).match(/M /g)).toHaveLength(30);
    expect(boardGridMarkup(7, 7, false, grid).match(/M /g)).toHaveLength(16);
    expect(() => validateLevel(round9f.puzzle)).not.toThrow();
    expect(() => validateLevel(round9g.puzzle)).not.toThrow();
  });

  it('validates every route and reports compact, full-footprint composition metrics', () => {
    expect(() => validateLevel(puzzle)).not.toThrow();
    const lengths = puzzle.arrows.map(routeLength);
    expect(lengths.filter((length) => length === 5)).toHaveLength(4);
    expect(lengths.filter((length) => length === 3)).toHaveLength(6);
    expect(lengths.filter((length) => length === 2)).toHaveLength(5);
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBe(48);
    const vertices = new Set(puzzle.arrows.flatMap(({ path }) => path.map(({ x, y }) => `${x},${y}`)));
    expect(vertices.size).toBe(63);
    const points = puzzle.arrows.flatMap(({ path }) => path);
    expect({
      minX: Math.min(...points.map(({ x }) => x)), maxX: Math.max(...points.map(({ x }) => x)),
      minY: Math.min(...points.map(({ y }) => y)), maxY: Math.max(...points.map(({ y }) => y)),
    }).toEqual({ minX: 0, maxX: 7, minY: 0, maxY: 7 });

    const composition = measureComposition(puzzle, 1.01);
    const spacing = measureNeighborSpacing(puzzle);
    const density = measureBoardDensity(puzzle, 0.125, 1.25);
    const directions = new Set(puzzle.arrows.map((arrow) => directionName(exitDirection(arrow))));
    const directionCounts = Object.fromEntries([...directions].map((direction) => [direction, puzzle.arrows.filter((arrow) => directionName(exitDirection(arrow)) === direction).length]));
    console.log('Round 9H composition metrics', { lengths, total: composition.totalPathLength,
      adjacentPathRatio: composition.adjacentGridPathRatio, nearestSpacing: spacing,
      directions: directionCounts, largeGapRatio: density.largeGapRatio, occupancyRatio: density.occupancyRatio,
      interleavedPairs: analyzeLevel(puzzle).interleavedPairs, closeSegmentContacts: analyzeLevel(puzzle).closeSegmentContacts,
      sharedBendsAt16: coordinatedBendPairs(puzzle.arrows, 1.6) });
    expect(composition.totalPathLength).toBe(48);
    expect(composition.adjacentGridPathRatio).toBeGreaterThan(0.85);
    expect(analyzeLevel(puzzle).interleavedPairs).toBe(9);
    expect(coordinatedBendPairs(puzzle.arrows, 1.1)).toBe(0);
    expect(coordinatedBendPairs(puzzle.arrows, 1.6)).toBe(10);
    expect(directions.size).toBe(4);
    expect(directionCounts).toEqual({ north: 4, south: 4, west: 4, east: 3 });
    expect(spacing.minimum).toBeGreaterThanOrEqual(1);
    expect(density.occupancyRatio).toBeCloseTo(48 / 49, 8);
    expect(density.largeGapRatio).toBeLessThan(0.01);
  });

  it('passes an exact reachable-state audit and replays its complete solution through gameplay simulation', () => {
    const logic = analyzeLevel(puzzle);
    expect(logic.blockingDependencies).toBe(21);
    expect(logic.dependencyDepth).toBe(8);
    expect(logic.initiallyRemovable).toBe(5);
    const audit = auditReachableStates(puzzle);
    expect(audit.exact).toBe(true);
    expect(audit.reachableStates).toBe(316);
    expect(audit.legalTransitions).toBe(1052);
    expect(audit.terminalStates).toBe(1);
    expect(audit.deadlocks).toEqual([]);
    expect(audit.dependencyCycles).toEqual([]);
    expect(audit.initialLegalMoves).toHaveLength(5);

    const solution = solveLevel(puzzle);
    expect(solution).not.toBeNull();
    let remaining = puzzle.arrows.slice();
    for (const id of solution!) {
      const moving = remaining.find(({ id: arrowId }) => arrowId === id)!;
      expect(simulateMove(moving, remaining.filter(({ id: arrowId }) => arrowId !== id), puzzle.width, puzzle.height, grid).ok).toBe(true);
      remaining = remaining.filter(({ id: arrowId }) => arrowId !== id);
    }
    expect(remaining).toEqual([]);

    // Same dimensions and paths under a different grid spec must not reuse the H solver cache.
    expect(() => solveLevel({ ...puzzle, grid: LEGACY_GRID_SPECIFICATION })).toThrow(/leaves the board/i);
  });

  it('keeps touch selection, fitted portrait/landscape views, zoom and pan aligned to the true grid', () => {
    for (const arrow of puzzle.arrows) {
      const segmentIndex = Math.floor((arrow.path.length - 1) / 2);
      const point = toBoardPoint({
        x: (arrow.path[segmentIndex].x + arrow.path[segmentIndex - 1].x) / 2,
        y: (arrow.path[segmentIndex].y + arrow.path[segmentIndex - 1].y) / 2,
      }, grid.pathOffset);
      expect(nearestArrowAt(point, puzzle.arrows, undefined, grid.pathOffset)).toBe(arrow.id);
    }

    const bounds = arrowCompositionBounds(puzzle.arrows, grid.pathOffset)!;
    for (const [width, height] of [[292, 420], [322, 540], [362, 630], [402, 720], [760, 300]]) {
      const camera = new BoardViewport(puzzle.width, puzzle.height);
      camera.fitToContent(bounds, width, height, 0.12);
      const fitted = camera.viewBox;
      expect(fitted.x).toBeLessThan(bounds.minX); expect(fitted.x + fitted.width).toBeGreaterThan(bounds.maxX);
      expect(fitted.y).toBeLessThan(bounds.minY); expect(fitted.y + fitted.height).toBeGreaterThan(bounds.maxY);
      camera.zoomAt(2, { x: fitted.x + fitted.width / 2, y: fitted.y + fitted.height / 2 });
      expect(camera.scale).toBeCloseTo(2, 8);
      camera.panBy(1000, 1000);
      expect(camera.viewBox.x).toBeLessThan(bounds.maxX);
      expect(camera.viewBox.x + camera.viewBox.width).toBeGreaterThan(bounds.minX);
      expect(camera.viewBox.y).toBeLessThan(bounds.maxY);
      expect(camera.viewBox.y + camera.viewBox.height).toBeGreaterThan(bounds.minY);
      camera.restoreFit();
      expect(camera.viewBox).toEqual(fitted);
    }
  });
});
