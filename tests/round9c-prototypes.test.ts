import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { measureComposition, measureFootprintDensity, measureNeighborSpacing, measureBoardDensity, pointInFootprint } from '../src/game/density';
import { analyzeLevel, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import { arrowsCollide } from '../src/game/geometry';
import { CURATED_LEVELS } from '../src/game/catalog';

const prototypes = JSON.parse(readFileSync(new URL('../src/game/prototypes/round9c-prototypes.json', import.meta.url), 'utf8')) as Array<{
  id: string; name: string; difficulty: string; purpose: string; previewCaption: string; compositionPlan: string; footprint: Array<Array<{x:number;y:number}>>;
  puzzle: { number: number; width: number; height: number; arrows: Array<{id:string;path:Array<{x:number;y:number}>}> };
}>;

const frozenFingerprints: Record<string, string> = {
  'round9c-compact-weave': '92a3fab3396cc7f076559a85a21897b24200981986f6065d3fa8571c58b0b8a3',
  'round9c-heart': '7f7984c409491e8f4d890f81cfa9e882abe1a83adcb76f61164a8ad289c43ed7',
  'round9c-advanced-weave': '5c0d96e970620859aa5a0d99d61e7b36ab0d1f3fcf19fb82f4dac88560608cf1',
};

describe('Round 9C composition prototypes', () => {
  it('keeps exactly three experiments separate from the Adventure catalog', () => {
    expect(prototypes.map(({id}) => id)).toEqual(['round9c-compact-weave','round9c-heart','round9c-advanced-weave']);
    expect(prototypes.every(({purpose,compositionPlan}) => purpose.trim() && compositionPlan.trim())).toBe(true);
    expect(prototypes.every(({previewCaption}) => previewCaption.trim().length > 0 && previewCaption.length <= 100)).toBe(true);
    expect(prototypes.map(({puzzle}) => puzzle.arrows.length)).toEqual([6,7,15]);
    expect(CURATED_LEVELS).toHaveLength(10);
    expect(CURATED_LEVELS.some(({id}) => id.startsWith('round9c-'))).toBe(false);
  });

  it.each(prototypes.map((prototype) => [prototype.name, prototype] as const))('%s is geometrically valid, solver/runtime-consistent, and has no reachable deadlocks', (_name, prototype) => {
    const { puzzle } = prototype;
    const collisions = puzzle.arrows.flatMap((a, i) => puzzle.arrows.slice(0, i).filter((b) => arrowsCollide(a,b)).map((b) => [a.id,b.id,a.path,b.path]));
    if (collisions.length) console.log(`${prototype.id} collisions: ${JSON.stringify(collisions)}`);
    if (!solveLevel(puzzle)) console.log(`${prototype.id} audit: ${JSON.stringify(auditReachableStates(puzzle))}`);
    expect(() => validateLevel(puzzle), prototype.id).not.toThrow();
    for (const arrow of puzzle.arrows) for (const point of arrow.path) {
      expect(pointInFootprint(point, prototype.footprint), `${prototype.id}/${arrow.id} at ${point.x},${point.y}`).toBe(true);
    }
    const solution = solveLevel(puzzle);
    expect(solution, prototype.id).not.toBeNull();
    let remaining = [...puzzle.arrows];
    for (const id of solution!) {
      const moving = remaining.find((arrow) => arrow.id === id)!;
      const result = simulateMove(moving, remaining.filter((arrow) => arrow.id !== id), puzzle.width, puzzle.height);
      expect(result.ok, `${prototype.id}/${id} from solver`).toBe(true);
      remaining = remaining.filter((arrow) => arrow.id !== id);
    }
    expect(remaining).toHaveLength(0);
    const audit = auditReachableStates(puzzle);
    expect(audit.exact).toBe(true);
    expect(audit.deadlocks, prototype.id).toEqual([]);
    expect(audit.dependencyCycles, prototype.id).toEqual([]);
    expect(audit.terminalStates).toBe(1);
  });

  it('freezes each prototype puzzle definition independently from Adventure Mode', () => {
    expect(Object.keys(frozenFingerprints).sort()).toEqual(prototypes.map(({ id }) => id).sort());
    for (const prototype of prototypes) {
      const fingerprint = createHash('sha256').update(JSON.stringify(prototype.puzzle)).digest('hex');
      expect(fingerprint, `${prototype.id} changed without an explicit visual review`).toBe(frozenFingerprints[prototype.id]);
    }
  });

  it('rejects visually weak composition candidates using authored quality thresholds', () => {
    const byId = new Map(prototypes.map((prototype) => [prototype.id, prototype]));
    const compact = byId.get('round9c-compact-weave')!;
    const heart = byId.get('round9c-heart')!;
    const advanced = byId.get('round9c-advanced-weave')!;
    const metrics = (prototype: typeof compact) => ({
      composition: measureComposition(prototype.puzzle),
      density: measureBoardDensity(prototype.puzzle),
      footprint: measureFootprintDensity({ puzzle: prototype.puzzle, footprint: prototype.footprint }),
      spacing: measureNeighborSpacing(prototype.puzzle),
      logic: analyzeLevel(prototype.puzzle),
    });

    const a = metrics(compact);
    expect(a.composition.adjacentGridPathRatio).toBeGreaterThanOrEqual(0.4);
    expect(a.footprint.largeGapRatio).toBeLessThanOrEqual(0.02);
    expect(a.spacing.minimum).toBeGreaterThanOrEqual(0.5);
    expect(a.logic.interleavedPairs).toBeGreaterThanOrEqual(1);
    expect(a.logic.dependencyDepth).toBeGreaterThanOrEqual(3);
    expect(a.logic.initiallyRemovable).toBeGreaterThanOrEqual(2);
    expect(a.composition.routeLengthBands).toEqual({ short: 4, medium: 1, long: 1 });

    const b = metrics(heart);
    expect(b.composition.adjacentGridPathRatio).toBeGreaterThanOrEqual(0.4);
    expect(b.footprint.largeGapRatio).toBe(0);
    expect(b.logic.blockingDependencies).toBeGreaterThanOrEqual(5);
    expect(b.logic.initiallyRemovable).toBeGreaterThanOrEqual(2);
    expect(Object.keys(b.composition.exitDirections).length).toBeGreaterThanOrEqual(4);

    const c = metrics(advanced);
    expect(c.composition.adjacentGridPathRatio).toBeGreaterThanOrEqual(0.18);
    expect(c.density.largeGapRatio).toBeLessThanOrEqual(0.09);
    expect(c.density.occupancyRatio).toBeGreaterThanOrEqual(0.65);
    expect(c.spacing.minimum).toBeGreaterThanOrEqual(0.5);
    expect(c.logic.interleavedPairs).toBeGreaterThanOrEqual(18);
    expect(c.logic.blockingDependencies).toBeGreaterThanOrEqual(20);
    expect(c.logic.dependencyDepth).toBeGreaterThanOrEqual(10);
    expect(c.logic.initiallyRemovable).toBeGreaterThanOrEqual(2);
    expect(c.composition.routeLengthBands).toEqual({ short: 5, medium: 7, long: 3 });
    expect(Object.keys(c.composition.exitDirections).length).toBeGreaterThanOrEqual(4);
  });

  it('prints all requested composition measurements for each frozen experimental board', () => {
    for (const prototype of prototypes) {
      const report = {
        id: prototype.id,
        arrows: prototype.puzzle.arrows.length,
        board: [prototype.puzzle.width, prototype.puzzle.height],
        routeLengths: analyzeLevel(prototype.puzzle).pathLengths.map((length) => +length.toFixed(1)),
        routeLengthBands: measureComposition(prototype.puzzle).routeLengthBands,
        turns: analyzeLevel(prototype.puzzle).turnCounts,
        adjacent: +measureComposition(prototype.puzzle).adjacentGridPathRatio.toFixed(3),
        parallel: +measureComposition(prototype.puzzle).parallelCorridorLength.toFixed(1),
        spacing: measureNeighborSpacing(prototype.puzzle),
        boardGaps: +measureBoardDensity(prototype.puzzle).largeGapRatio.toFixed(3),
        footprint: +measureFootprintDensity({ puzzle: prototype.puzzle, footprint: prototype.footprint }).largeGapRatio.toFixed(3),
        dependencies: analyzeLevel(prototype.puzzle).blockingDependencies,
        dependencyDepth: analyzeLevel(prototype.puzzle).dependencyDepth,
        initiallyRemovable: analyzeLevel(prototype.puzzle).initiallyRemovable,
        interleavedPairs: analyzeLevel(prototype.puzzle).interleavedPairs,
        audit: { states: auditReachableStates(prototype.puzzle).reachableStates, transitions: auditReachableStates(prototype.puzzle).legalTransitions, initialMoves: auditReachableStates(prototype.puzzle).initialLegalMoves.length },
      };
      console.log(`${prototype.id}: ${JSON.stringify(report)}`);
    }
  });
});
