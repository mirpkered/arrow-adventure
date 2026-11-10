import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { analyzeLevel, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditReachableStates, MAX_EXACT_AUDIT_ARROWS } from '../src/game/stateAudit';
import { measureComposition, measureFootprintDensity, measureNeighborSpacing } from '../src/game/density';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';
import type { Level, Point } from '../src/game/types';

const prototypes = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9d-prototypes.json', import.meta.url), 'utf8')) as Array<{
  id: string; name: string; compositionStyle: string; purpose: string; compositionPlan: string; previewCaption: string;
  footprint: Point[][]; puzzle: Level;
}>;

describe('Round 9D composition prototypes', () => {
  it('keeps five distinct, named experimental compositions outside the Adventure catalog', () => {
    expect(prototypes.map(({ id }) => id)).toEqual([
      'round9d-micro-arrow-field', 'round9d-dense-interwoven-maze', 'round9d-tree-silhouette',
      'round9d-large-mixed-weave', 'round9d-framed-composition',
    ]);
    expect(new Set(prototypes.map(({ compositionStyle }) => compositionStyle)).size).toBe(5);
    expect(prototypes.every(({ purpose, compositionPlan, previewCaption }) => purpose && compositionPlan && previewCaption)).toBe(true);
  });

  it.each(prototypes.map((prototype) => [prototype.name, prototype] as const))('%s has valid geometry and an exhaustive deadlock-free audit', (_name, prototype) => {
    expect(prototype.puzzle.arrows.length).toBeLessThanOrEqual(MAX_EXACT_AUDIT_ARROWS);
    expect(() => validateLevel(prototype.puzzle), prototype.id).not.toThrow();
    const solution = solveLevel(prototype.puzzle);
    expect(solution, prototype.id).not.toBeNull();
    let remaining = prototype.puzzle.arrows.slice();
    for (const arrowId of solution!) {
      const arrow = remaining.find(({ id }) => id === arrowId)!;
      expect(simulateMove(arrow, remaining.filter(({ id }) => id !== arrowId), prototype.puzzle.width, prototype.puzzle.height).ok, `${prototype.id} ${arrowId}`).toBe(true);
      remaining = remaining.filter(({ id }) => id !== arrowId);
    }
    expect(remaining).toEqual([]);
    const audit = auditReachableStates(prototype.puzzle);
    expect(audit.exact, prototype.id).toBe(true);
    expect(audit.deadlocks, prototype.id).toEqual([]);
    expect(audit.dependencyCycles, prototype.id).toEqual([]);
    expect(audit.terminalStates, prototype.id).toBe(1);
  });

  it('reports composition diagnostics for visual review without replacing it', () => {
    for (const prototype of prototypes) {
      const report = {
        id: prototype.id,
        arrows: prototype.puzzle.arrows.length,
        board: [prototype.puzzle.width, prototype.puzzle.height],
        routes: analyzeLevel(prototype.puzzle).pathLengths.map((value) => +value.toFixed(1)),
        turns: analyzeLevel(prototype.puzzle).turnCounts,
        composition: measureComposition(prototype.puzzle),
        spacing: measureNeighborSpacing(prototype.puzzle),
        footprint: measureFootprintDensity(prototype),
        logic: {
          dependencies: analyzeLevel(prototype.puzzle).blockingDependencies,
          depth: analyzeLevel(prototype.puzzle).dependencyDepth,
          initiallyRemovable: analyzeLevel(prototype.puzzle).initiallyRemovable,
          interleavedPairs: analyzeLevel(prototype.puzzle).interleavedPairs,
        },
        audit: (() => {
          const result = auditReachableStates(prototype.puzzle);
          return { states: result.reachableStates, transitions: result.legalTransitions, terminalStates: result.terminalStates, deadlocks: result.deadlocks.length, dependencyCycles: result.dependencyCycles.length };
        })(),
      };
      console.log(`${prototype.id}: ${JSON.stringify(report)}`);
    }
  });

  it('rejects weak packing and preserves the intended distinctions between composition styles', () => {
    const reports = prototypes.map((prototype) => ({
      prototype,
      composition: measureComposition(prototype.puzzle),
      logic: analyzeLevel(prototype.puzzle),
      spacing: measureNeighborSpacing(prototype.puzzle),
    }));
    const micro = reports[0];
    expect(micro.prototype.puzzle.arrows).toHaveLength(20);
    expect(micro.composition.routeLengthBands).toEqual({ short: 20, medium: 0, long: 0 });
    expect(micro.composition.adjacentGridPathRatio).toBeGreaterThan(0.5);
    expect(measureFootprintDensity(micro.prototype, 0.25, 1.5).largeGapRatio).toBeLessThan(0.1);

    const maze = reports[1];
    expect(maze.composition.adjacentGridPathRatio).toBeGreaterThan(0.5);
    expect(maze.logic.interleavedPairs).toBeGreaterThanOrEqual(10);
    expect(maze.logic.blockingDependencies).toBeGreaterThanOrEqual(12);
    expect(maze.logic.dependencyDepth).toBeGreaterThanOrEqual(4);
    expect(maze.logic.initiallyRemovable).toBeLessThanOrEqual(3);
    expect(measureFootprintDensity(maze.prototype, 0.25, 1.5).largeGapRatio).toBeLessThan(0.15);

    const tree = reports[2];
    expect(tree.prototype.footprint.length).toBeGreaterThan(0);
    expect(tree.composition.routeLengthBands.long).toBe(2);
    expect(tree.prototype.puzzle.arrows.length).toBeGreaterThanOrEqual(10);
    expect(measureFootprintDensity(tree.prototype, 0.25, 1.5).largeGapRatio).toBeLessThan(0.05);

    const large = reports[3];
    expect(large.prototype.puzzle.width).toBeGreaterThan(maze.prototype.puzzle.width);
    expect(large.composition.routeLengthBands).toEqual({ short: 2, medium: 7, long: 4 });
    expect(large.composition.adjacentGridPathRatio).toBeGreaterThan(0.6);
    expect(large.logic.interleavedPairs).toBeGreaterThanOrEqual(15);
    expect(large.logic.dependencyDepth).toBeGreaterThanOrEqual(5);
    expect(large.spacing.p90).toBeLessThanOrEqual(1.5);
    expect(measureFootprintDensity(large.prototype, 0.25, 1.5).largeGapRatio).toBeLessThan(0.31);

    const framed = reports[4];
    expect(framed.prototype.footprint.length).toBe(1);
    expect(framed.logic.dependencyDepth).toBeGreaterThanOrEqual(4);
    expect(framed.logic.initiallyRemovable).toBe(2);
    expect(framed.prototype.compositionPlan.toLowerCase()).toContain('window');
    expect(measureFootprintDensity(framed.prototype, 0.25, 1.5).largeGapRatio).toBeLessThan(0.15);
  });

  it('freezes all five playable definitions against accidental geometry changes', () => {
    const expected: Record<string, string> = {
      'round9d-micro-arrow-field': '0b3fb66812e1cef09580ff56b7c753245de2130084ed623da3c14b03ab9f8c70',
      'round9d-dense-interwoven-maze': '42941283103aaef2ff997496b878cc0898aa899b9ae373adfb0677f37914ba20',
      'round9d-tree-silhouette': 'a6718c3cfa557ff97d4f059d217e5fdb7389b9ba999f9b15fcc31d6b926890af',
      'round9d-large-mixed-weave': 'ac50419f2cb89ea19c830386cc6fb1187d543123e4928c318eb03dcb856546f2',
      'round9d-framed-composition': 'db95417b8fea0918d82856a810655f9dd3770e95b94d55f1826c1ea3322e7d03',
    };
    for (const prototype of prototypes) {
      expect(createHash('sha256').update(JSON.stringify(prototype.puzzle)).digest('hex'), prototype.id).toBe(expected[prototype.id]);
    }
  });

  it.each(prototypes.map((prototype) => [prototype.name, prototype] as const))('%s fits its complete artwork at phone, tablet, and landscape sizes', (_name, prototype) => {
    const bounds = arrowCompositionBounds(prototype.puzzle.arrows)!;
    for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
      const camera = new BoardViewport(prototype.puzzle.width, prototype.puzzle.height);
      camera.fitToContent(bounds, width, height);
      const view = camera.viewBox;
      expect(view.width / view.height).toBeCloseTo(width / height, 6);
      expect(view.x).toBeLessThan(bounds.minX);
      expect(view.x + view.width).toBeGreaterThan(bounds.maxX);
      expect(view.y).toBeLessThan(bounds.minY);
      expect(view.y + view.height).toBeGreaterThan(bounds.maxY);
      camera.zoomAt(2, { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });
      camera.panBy(1000, 1000);
      expect(camera.viewBox.x + camera.viewBox.width).toBeGreaterThan(bounds.minX);
      expect(camera.viewBox.y + camera.viewBox.height).toBeGreaterThan(bounds.minY);
      camera.restoreFit();
      expect(camera.scale).toBe(1);
    }
  });
});
