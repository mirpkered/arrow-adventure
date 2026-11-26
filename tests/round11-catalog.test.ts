import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS, validateCuratedLevels } from '../src/game/catalog';
import { boardGridMarkup } from '../src/app/boardGrid';
import { measureComposition, measureFootprintDensity, measureNeighborSpacing } from '../src/game/density';
import { analyzeLevel, completeLevel, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import type { CuratedLevel } from '../src/game/types';
import round10 from '../src/game/archive/adventure-catalog-first-flight-r2.json';

const routeLengths = (entry: CuratedLevel) => entry.puzzle.arrows.map(({ path }) => path.length - 1);
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('Round 11 compactness refinement', () => {
  it('keeps the approved five level IDs, dimensions, arrow counts, and true-grid rules', () => {
    expect(CURATED_LEVELS.map(({ id }) => id)).toEqual([
      'first-flight-001', 'first-flight-002', 'first-flight-003', 'first-flight-004', 'first-flight-005',
    ]);
    expect(CURATED_LEVELS.map(({ puzzle }) => [puzzle.width, puzzle.height, puzzle.arrows.length])).toEqual([
      [5, 5, 5], [6, 6, 8], [7, 7, 10], [7, 8, 12], [8, 8, 15],
    ]);
    expect(CURATED_LEVELS.every(({ catalogVersion }) => catalogVersion === 'first-flight-r3-compact-weave')).toBe(true);
    expect(CURATED_LEVELS.map(({ contentVersion }) => contentVersion)).toEqual([2, 2, 3, 2, 2]);
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
    CURATED_LEVELS.forEach((entry, index) => {
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
});
