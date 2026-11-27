import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS, validateCuratedLevels } from '../src/game/catalog';
import { boardGridMarkup } from '../src/app/boardGrid';
import { measureComposition, measureFootprintDensity, measureNeighborSpacing } from '../src/game/density';
import { analyzeLevel, completeLevel, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditBlockerGraph, auditReachableStates } from '../src/game/stateAudit';
import type { CuratedLevel } from '../src/game/types';
import round10 from '../src/game/archive/adventure-catalog-first-flight-r2.json';

const routeLengths = (entry: CuratedLevel) => entry.puzzle.arrows.map(({ path }) => path.length - 1);
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('Round 11 compactness refinement', () => {
  it('keeps the approved five level IDs, dimensions, arrow counts, and true-grid rules', () => {
    expect(CURATED_LEVELS.slice(0, 5).map(({ id }) => id)).toEqual([
      'first-flight-001', 'first-flight-002', 'first-flight-003', 'first-flight-004', 'first-flight-005',
    ]);
    expect(CURATED_LEVELS.slice(0, 5).map(({ puzzle }) => [puzzle.width, puzzle.height, puzzle.arrows.length])).toEqual([
      [5, 5, 5], [6, 6, 8], [7, 7, 10], [7, 8, 12], [8, 8, 15],
    ]);
    expect(CURATED_LEVELS).toHaveLength(7);
    expect(CURATED_LEVELS.every(({ catalogVersion }) => catalogVersion === 'first-flight-r4-large-grid')).toBe(true);
    expect(CURATED_LEVELS.map(({ contentVersion }) => contentVersion)).toEqual([2, 2, 3, 2, 2, 1, 1]);
    expect(fingerprint(round10)).toBe('ec345f51cdf681be57f044c9bd62c88600715ff0efd65c55c05979a48a6ba8c0');
    for (const entry of CURATED_LEVELS) {
      const { puzzle } = entry;
      expect(puzzle.grid).toEqual({ spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true });
      expect(boardGridMarkup(puzzle.width, puzzle.height, false, puzzle.grid).match(/M /g)).toHaveLength(puzzle.width + puzzle.height + 2);
      for (const arrow of puzzle.arrows) for (let index = 0; index < arrow.path.length; index += 1) {
        const point = arrow.path[index];
        expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
        if (index) {
          const dx = Math.abs(point.x - arrow.path[index - 1].x), dy = Math.abs(point.y - arrow.path[index - 1].y);
          expect(dx === 0 || dy === 0).toBe(true);
          expect(Math.max(dx, dy)).toBe(1);
        }
      }
    }
    expect(() => validateCuratedLevels()).not.toThrow();
  });

  it('freezes reproducible composition fingerprints and completes exact simulator-backed audits', () => {
    const expectedLengths = [
      [6, 7, 9, 7, 2],
      [3, 3, 8, 7, 6, 6, 7, 1],
      [6, 4, 7, 4, 7, 6, 7, 5, 7, 1],
      [5, 1, 1, 7, 8, 6, 8, 6, 5, 5, 4, 4],
      [4, 4, 6, 7, 2, 3, 5, 7, 5, 4, 7, 5, 5, 1, 1],
    ];
    const expectedHashes = [
      '37cbe680ff4584bb62ce00e0b339cccfcba84b684e2067e9c785f9cc3f2d9faa',
      '9d1363d47f6ab4fe8f3ac389037123f94491934739fe5c23af31bbcad6b0515e',
      'fbdf1b1a9a9d0c4bf770fa3c4d998ebdcc82524a2290588b4f45375963361dd1',
      '80ecd915ed11398c641c227aa20ccab6a72d633a3cfa0d6cc45af5fda796a66d',
      '0889f74c4ebe063b8d864607e518ea6141fd3ca6227c32cb494e1b8f61e87381',
    ];
    const expectedTransitions = [9, 35, 212, 124, 137];
    const expectedStatesCurrent = [8, 21, 84, 56, 66];
    const priorRouteUnits = [21, 26, 36, 47, 55];
    const priorInterleaved = [1, 2, 4, 6, 7];
    const priorContacts = [45, 49, 72, 122, 144];
    CURATED_LEVELS.slice(0, 5).forEach((entry, index) => {
      const { puzzle } = entry;
      expect(routeLengths(entry)).toEqual(expectedLengths[index]);
      expect(fingerprint(puzzle)).toBe(expectedHashes[index]);
      validateLevel(puzzle);
      const solution = solveLevel(puzzle);
      expect(solution, entry.id).not.toBeNull();
      let remaining = [...puzzle.arrows];
      for (const id of solution!) {
        const moving = remaining.find((arrow) => arrow.id === id)!;
        const stationary = remaining.filter((arrow) => arrow.id !== id);
        expect(simulateMove(moving, stationary, puzzle.width, puzzle.height, puzzle.grid).ok, `${entry.id}/${id}`).toBe(true);
        remaining = stationary;
      }
      expect(completeLevel(remaining)).toBe(true);
      const audit = auditReachableStates(puzzle);
      expect(audit.exact).toBe(true);
      expect(audit.reachableStates).toBe(expectedStatesCurrent[index]);
      expect(audit.legalTransitions).toBe(expectedTransitions[index]);
      expect(audit.terminalStates).toBe(1);
      expect(audit.initialLegalMoves.length).toBeGreaterThan(0);
      expect(audit.deadlocks).toEqual([]);
      expect(audit.dependencyCycles).toEqual([]);
      const metrics = analyzeLevel(puzzle);
      const spacing = measureNeighborSpacing(puzzle);
      const composition = measureComposition(puzzle, 1.01);
      const density = measureFootprintDensity(entry);
      expect(routeLengths(entry).reduce((sum, length) => sum + length, 0)).toBeGreaterThan(priorRouteUnits[index]);
      expect(metrics.interleavedPairs).toBeGreaterThan(priorInterleaved[index]);
      expect(metrics.closeSegmentContacts).toBeGreaterThan(priorContacts[index]);
      expect(metrics.initiallyRemovable).toBe([2, 3, 4, 4, 3][index]);
      expect(metrics.dependencyDepth).toBeGreaterThanOrEqual([4, 3, 5, 5, 6][index]);
      expect(spacing.p10).toBe(1);
      expect(spacing.median).toBe(1);
      expect(spacing.p90).toBe(1);
      expect(composition.adjacentGridPathRatio).toBeGreaterThan(0.8);
      expect(density.largeGapRatio).toBe(0);
    });
  });

  it('adds dense 10×10 and 12×12 puzzles with exact/graph certificates and stable fingerprints', () => {
    const large = CURATED_LEVELS.slice(5);
    expect(large.map(({ id, authoringSeed, contentVersion }) => [id, authoringSeed, contentVersion])).toEqual([
      ['first-flight-006', 13309, 1], ['first-flight-007', 14825, 1],
    ]);
    expect(large.map(({ puzzle }) => [puzzle.width, puzzle.height, puzzle.arrows.length])).toEqual([[10, 10, 20], [12, 12, 30]]);
    const expectedHashes = [
      '45c271cfd0f4ee3e06861df354beae8268563ea74985da621231a5428761447e',
      'a45addaed4ccc5491bf0b1f925d0b63cfca3d6375c6f243a40a537a8d8ed77d4',
    ];
    const expectedRoutes = [
      [1, 8, 7, 6, 5, 1, 5, 7, 8, 8, 1, 7, 3, 2, 8, 7, 4, 8, 2, 3],
      [1, 7, 4, 3, 3, 3, 3, 7, 5, 7, 3, 2, 3, 7, 6, 7, 2, 6, 6, 1, 4, 5, 7, 3, 7, 6, 6, 5, 7, 3],
    ];
    large.forEach((entry, index) => {
      const { puzzle } = entry;
      expect(fingerprint(puzzle)).toBe(expectedHashes[index]);
      expect(routeLengths(entry)).toEqual(expectedRoutes[index]);
      expect(new Set(puzzle.arrows.flatMap(({ path }) => path.map(({ x, y }) => `${x},${y}`))).size)
        .toBe((puzzle.width + 1) * (puzzle.height + 1));
      validateLevel(puzzle);
      const graph = auditBlockerGraph(puzzle);
      expect(graph.completeGuarantee).toBe(true);
      expect(graph.stateEnumeration).toBe(false);
      expect(graph.removalSequence).toHaveLength(puzzle.arrows.length);
      expect(graph.dependencyCycles).toEqual([]);
      const metrics = analyzeLevel(puzzle);
      const isolated = Object.entries(metrics.interleavedPairsByArrow)
        .filter(([id, degree]) => degree === 0 && metrics.blockersByArrow[id] === 0).map(([id]) => id);
      expect(isolated, `${entry.id} isolated arrows`).toEqual([]);
      expect(metrics.blockingDependencies).toBe(index === 0 ? 31 : 66);
      expect(metrics.dependencyDepth).toBe(index === 0 ? 5 : 7);
      expect(metrics.initiallyRemovable).toBe(index === 0 ? 5 : 4);
      if (index === 0) {
        const exact = auditReachableStates(puzzle);
        expect(exact).toMatchObject({ reachableStates: 2206, legalTransitions: 9163, terminalStates: 1, deadlocks: [], dependencyCycles: [] });
        expect(exact.initialLegalMoves).toHaveLength(5);
      } else expect(graph.initialLegalMoves).toHaveLength(4);
    });
  });
});
