import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport, compositionBounds } from '../src/app/viewport';
import { boardGridMarkup, silhouetteGridMarkup } from '../src/app/boardGrid';
import { analyzeLevel, directionName, exitDirection, nearestArrowAt, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { segmentDistance } from '../src/game/geometry';
import { measureFootprintDensity, measureNeighborSpacing, pointInFootprint } from '../src/game/density';
import { auditReachableStates } from '../src/game/stateAudit';
import { createPrototypeReviewRun, PROTOTYPE_REVIEWS, renderPrototypeReviewSelection } from '../src/qa/prototypeReview';
import type { Arrow, GridSpecification, Point } from '../src/game/types';

type HeartDefinition = {
  id: string; name: string; displayLabel: string; contentVersion: number; footprint: Point[][];
  puzzleFingerprintSha256: string;
  clipGridToFootprint: boolean; puzzle: { number: number; width: number; height: number; grid: GridSpecification; arrows: Arrow[] };
};
const definition = JSON.parse(readFileSync(new URL('../src/game/prototypes/round12-heart.json', import.meta.url), 'utf8')) as HeartDefinition;
const puzzle = definition.puzzle;
const grid = puzzle.grid!;
const prototype = PROTOTYPE_REVIEWS.find(({ id }) => id === definition.id)!;
const fingerprint = createHash('sha256').update(JSON.stringify(puzzle)).digest('hex');

describe('Round 12 full-area heart prototype', () => {
  it('freezes the prototype outside the Adventure catalog on a true 10×11 visible grid', () => {
    expect(definition).toMatchObject({ id: 'prototype-round12-heart', name: 'Heart Prototype', displayLabel: 'Round 12 — Heart Prototype', contentVersion: 1, clipGridToFootprint: true });
    expect(puzzle).toMatchObject({ number: 1, width: 10, height: 11, grid: { spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true } });
    expect(puzzle.arrows).toHaveLength(14);
    expect(definition.puzzleFingerprintSha256).toBe(fingerprint);
    expect(PROTOTYPE_REVIEWS.at(-1)?.id).toBe(definition.id);
    expect(renderPrototypeReviewSelection()).toContain('Round 12 — Heart Prototype');
    expect(fingerprint).toBe('8bd2f9cabfe351654291158711aeb498a729b51f984fe917a04da0249e85e256');
  });

  it('fills the authored heart from both lobes through the notch, shoulders, and lower point', () => {
    expect(definition.footprint).toHaveLength(1);
    const outline = definition.footprint[0];
    expect(outline.length).toBe(20);
    for (const point of outline) {
      expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(puzzle.width);
      expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(puzzle.height);
    }
    for (let left = 0; left < outline.length; left += 1) for (let right = left + 1; right < outline.length; right += 1) {
      if (right === left + 1 || (left === 0 && right === outline.length - 1)) continue;
      const a = outline[left]; const b = outline[(left + 1) % outline.length];
      const c = outline[right]; const d = outline[(right + 1) % outline.length];
      expect(segmentDistance({ a, b }, { a: c, b: d })).toBeGreaterThan(1e-8);
    }
    const edgeLengths = puzzle.arrows.map(({ path }) => path.length - 1).sort((a, b) => a - b);
    expect(edgeLengths).toEqual([2, 2, 3, 3, 4, 4, 4, 4, 5, 5, 6, 6, 7, 8]);
    expect(edgeLengths.reduce((sum, length) => sum + length, 0)).toBe(63);
    const routePoints = puzzle.arrows.flatMap(({ path }) => path);
    expect({ minX: Math.min(...routePoints.map(({ x }) => x)), maxX: Math.max(...routePoints.map(({ x }) => x)), minY: Math.min(...routePoints.map(({ y }) => y)), maxY: Math.max(...routePoints.map(({ y }) => y)) })
      .toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 11 });
    for (const arrow of puzzle.arrows) {
      for (const point of arrow.path) expect(pointInFootprint(point, definition.footprint), `${arrow.id} vertex ${point.x},${point.y}`).toBe(true);
      for (let i = 1; i < arrow.path.length; i += 1) {
        const a = arrow.path[i - 1]; const b = arrow.path[i];
        expect(Math.abs(b.x - a.x) + Math.abs(b.y - a.y)).toBe(1);
        for (let step = 0; step <= 20; step += 1) {
          const t = step / 20;
          expect(pointInFootprint({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t }, definition.footprint), `${arrow.id} segment ${i-1}`).toBe(true);
        }
      }
    }
    const density = measureFootprintDensity({ puzzle, footprint: definition.footprint }, .25, 1.5);
    expect(density.pathLengthInside).toBeCloseTo(density.pathLength, 6);
    expect(density.largeGapRatio).toBeLessThanOrEqual(.01);
    expect(density.footprintArea).toBe(71.5);
    expect(density.occupancyRatio).toBeCloseTo(63 / 71.5, 6);
  });

  it('passes geometry, swept movement, exact reachable-state audit, and runtime replay', () => {
    expect(() => validateLevel(puzzle)).not.toThrow();
    const analysis = analyzeLevel(puzzle);
    const audit = auditReachableStates(puzzle);
    expect(audit.exact).toBe(true);
    expect(audit.deadlocks).toEqual([]);
    expect(audit.dependencyCycles).toEqual([]);
    expect(audit.terminalStates).toBe(1);
    expect(audit.reachableStates).toBe(112);
    expect(audit.legalTransitions).toBe(288);
    expect(audit.initialLegalMoves).toEqual(['h03', 'h06', 'h11', 'h13', 'h14']);
    expect(audit.initialLegalMoves.length).toBeGreaterThan(0);
    expect(analysis.interleavedPairs).toBe(12);
    expect(analysis.closeSegmentContacts).toBe(184);
    expect(analysis.blockingDependencies).toBe(20);
    expect(analysis.dependencyDepth).toBeGreaterThanOrEqual(4);
    expect(analysis.blockingDependencies).toBeGreaterThanOrEqual(10);
    expect(analysis.initiallyRemovable).toBe(5);
    const spacing = measureNeighborSpacing(puzzle);
    expect(spacing).toMatchObject({ minimum: 1, p10: 1, median: 1, p90: 1 });
    const solution = solveLevel(puzzle);
    expect(solution).not.toBeNull();
    let remaining = [...puzzle.arrows];
    for (const id of solution!) {
      const moving = remaining.find(({ id: arrowId }) => arrowId === id)!;
      expect(simulateMove(moving, remaining.filter(({ id: arrowId }) => arrowId !== id), puzzle.width, puzzle.height, grid).ok).toBe(true);
      remaining = remaining.filter(({ id: arrowId }) => arrowId !== id);
    }
    expect(remaining).toEqual([]);
    const exits: Record<string, number> = {};
    for (const arrow of puzzle.arrows) { const direction = directionName(exitDirection(arrow)); exits[direction] = (exits[direction] ?? 0) + 1; }
    expect(exits).toEqual({ south: 4, west: 3, east: 3, north: 4 });
  });

  it('clips only the lattice, keeps the regular coordinate transform, and fits the whole silhouette on phones', () => {
    expect(boardGridMarkup(puzzle.width, puzzle.height, false, grid).match(/M /g)).toHaveLength(puzzle.width + puzzle.height + 2);
    const markup = silhouetteGridMarkup(puzzle.width, puzzle.height, definition.footprint, false, grid);
    expect(markup).toContain('clipPathUnits="userSpaceOnUse"');
    expect(markup).toContain('clip-path="url(#active-silhouette-clip)"');
    expect(markup).toContain('class="board-footprint-outline"');
    expect(markup).toContain('M 5 1 L 4 0');
    const shapeBounds = compositionBounds(puzzle.arrows, definition.footprint, grid.pathOffset)!;
    const arrowBounds = arrowCompositionBounds(puzzle.arrows, grid.pathOffset)!;
    expect(shapeBounds.minY).toBeLessThanOrEqual(arrowBounds.minY);
    expect(shapeBounds.maxY).toBeGreaterThanOrEqual(arrowBounds.maxY);
    for (const [width, height] of [[320,568],[390,844],[430,932]]) {
      const camera = new BoardViewport(puzzle.width, puzzle.height);
      camera.fitToContent(shapeBounds, width, height, .055);
      const view = camera.viewBox;
      expect(view.x).toBeLessThan(shapeBounds.minX); expect(view.x + view.width).toBeGreaterThan(shapeBounds.maxX);
      expect(view.y).toBeLessThan(shapeBounds.minY); expect(view.y + view.height).toBeGreaterThan(shapeBounds.maxY);
      for (const arrow of puzzle.arrows) {
        const index = Math.floor((arrow.path.length - 1) / 2);
        const point = { x: (arrow.path[index].x + arrow.path[index - 1].x)/2, y: (arrow.path[index].y + arrow.path[index - 1].y)/2 };
        expect(nearestArrowAt(point, puzzle.arrows, undefined, grid.pathOffset)).toBe(arrow.id);
      }
      camera.zoomAt(2, { x: view.x + view.width / 2, y: view.y + view.height / 2 });
      camera.panBy(1000, 1000);
      expect(camera.viewBox.x).toBeLessThan(shapeBounds.maxX); expect(camera.viewBox.y).toBeLessThan(shapeBounds.maxY);
      camera.restoreFit(); expect(camera.viewBox).toEqual(view);
    }
  });

  it('runs through the QA prototype selector with fresh three-heart state and no Adventure progress coupling', () => {
    expect(prototype).toMatchObject({ displayLabel: 'Round 12 — Heart Prototype', clipGridToFootprint: true });
    const run = createPrototypeReviewRun(definition.id)!;
    expect(run.run.hearts).toBe(3); expect(run.run.arrows).toHaveLength(14);
    run.run.arrows.pop();
    expect(createPrototypeReviewRun(definition.id)!.run.arrows).toHaveLength(14);
  });
});
