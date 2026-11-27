import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS } from '../src/game/catalog';
import { analyzeBlockerDependencies, auditBlockerGraph, auditReachableStates, MAX_EXACT_AUDIT_ARROWS } from '../src/game/stateAudit';
import { buildExitBlockers, simulateMove, solveLevel } from '../src/game/rules';
import type { Level } from '../src/game/types';

describe('scalable static-blocker solvability certificate', () => {
  it('agrees with exhaustive state enumeration for every current Adventure level', () => {
    for (const { puzzle } of CURATED_LEVELS) {
      const graph = auditBlockerGraph(puzzle);
      expect(graph.method).toBe('static-blocker-dag');
      expect(graph.stateEnumeration).toBe(false);
      expect(graph.completeGuarantee).toBe(true);
      expect(graph.dependencyCycles).toEqual([]);
      if (puzzle.arrows.length <= MAX_EXACT_AUDIT_ARROWS) {
        const exact = auditReachableStates(puzzle);
        expect(graph.initialLegalMoves).toEqual(exact.initialLegalMoves);
        expect(graph.dependencyCycles).toEqual(exact.dependencyCycles);
        expect(exact.deadlocks).toEqual([]);
      }
      expect(graph.removalSequence).toHaveLength(puzzle.arrows.length);

      let remaining = [...puzzle.arrows];
      for (const id of graph.removalSequence) {
        const moving = remaining.find((arrow) => arrow.id === id)!;
        expect(simulateMove(moving, remaining.filter((arrow) => arrow.id !== id), puzzle.width, puzzle.height, puzzle.grid).ok).toBe(true);
        remaining = remaining.filter((arrow) => arrow.id !== id);
      }
      expect(remaining).toEqual([]);
    }
  });

  it('matches full multi-obstacle gameplay legality at every subset of several authored small boards', () => {
    for (const { puzzle } of CURATED_LEVELS.slice(0, 2)) {
      const blockers = buildExitBlockers(puzzle);
      const count = puzzle.arrows.length;
      for (let mask = 0; mask < 2 ** count; mask += 1) {
        const remaining = puzzle.arrows.filter((_, index) => (mask & (1 << index)) !== 0);
        for (const moving of remaining) {
          const stationary = remaining.filter(({ id }) => id !== moving.id);
          const gameplayLegal = simulateMove(moving, stationary, puzzle.width, puzzle.height, puzzle.grid).ok;
          const graphLegal = [...blockers.get(moving.id)!].every((blocker) => !stationary.some(({ id }) => id === blocker));
          expect(graphLegal, `${puzzle.number}/${mask}/${moving.id}`).toBe(gameplayLegal);
        }
      }
    }
  });

  it('certifies a valid 21-arrow board without enumerating 2^21 states', () => {
    const level: Level = {
      number: 99,
      width: 2,
      height: 21,
      grid: { spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true },
      arrows: Array.from({ length: 21 }, (_, index) => ({ id: `a${index}`, path: [{ x: 0, y: index }, { x: 1, y: index }] })),
    };
    expect(level.arrows.length).toBeGreaterThan(MAX_EXACT_AUDIT_ARROWS);
    const graph = auditBlockerGraph(level);
    expect(graph.completeGuarantee).toBe(true);
    expect(graph.blockerEdges).toBe(0);
    expect(graph.removalSequence).toHaveLength(21);
    expect(solveLevel(level)).toHaveLength(21);
    expect(() => auditReachableStates(level)).toThrow(/bounded to 20 arrows/i);
  });

  it('returns a concrete reachable deadlock witness for a cyclic dependency graph', () => {
    const graph = analyzeBlockerDependencies(['a', 'b', 'c', 'd'], new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['a'])],
      ['c', new Set()],
      ['d', new Set(['a'])],
    ]));
    expect(graph.completeGuarantee).toBe(false);
    expect(graph.initialLegalMoves).toEqual(['c']);
    expect(graph.removalSequence).toEqual(['c']);
    expect(graph.dependencyCycles).toEqual([['a', 'b']]);
    expect(graph.deadlockWitness).toEqual({ remainingArrowIds: ['a', 'b', 'd'], removalSequence: ['c'] });
  });
});
