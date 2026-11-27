import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS, getCuratedLevel, getCuratedLevelById, getNextCuratedLevel, validateCuratedLevels } from '../src/game/catalog';
import { boardGridMarkup } from '../src/app/boardGrid';
import { measureNeighborSpacing } from '../src/game/density';
import { analyzeLevel, simulateMove, solveLevel, validateLevel } from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import retiredR1Catalog from '../src/game/archive/adventure-catalog-first-flight-r1.json';
import round10Catalog from '../src/game/archive/adventure-catalog-first-flight-r2.json';

describe('Round 11 active catalog and preserved Round 10 content', () => {
  it('preserves the Round 9 and exact Round 10 catalogs in their archives', () => {
    expect(retiredR1Catalog.catalogVersion).toBe('first-flight-r1');
    expect(retiredR1Catalog.levels).toHaveLength(10);
    expect(createHash('sha256').update(JSON.stringify(retiredR1Catalog)).digest('hex'))
      .toBe('0cff244d130159eea2ce6e4f294927317aa14d466bb35af672ca9e8d392b68de');
    expect(round10Catalog.catalogVersion).toBe('first-flight-r2-true-grid');
    expect(round10Catalog.levels).toHaveLength(5);
    expect(createHash('sha256').update(JSON.stringify(round10Catalog)).digest('hex'))
      .toBe('ec345f51cdf681be57f044c9bd62c88600715ff0efd65c55c05979a48a6ba8c0');
  });

  it('preserves the five opening IDs and appends larger true visible-grid levels', () => {
    expect(CURATED_LEVELS.map(({ id }) => id)).toEqual([
      'first-flight-001', 'first-flight-002', 'first-flight-003', 'first-flight-004', 'first-flight-005',
      'first-flight-006', 'first-flight-007',
    ]);
    expect(CURATED_LEVELS.map(({ puzzle }) => [puzzle.width, puzzle.height, puzzle.arrows.length])).toEqual([
      [5, 5, 5], [6, 6, 8], [7, 7, 10], [7, 8, 12], [8, 8, 15], [10, 10, 20], [12, 12, 30],
    ]);
    for (const { puzzle } of CURATED_LEVELS) {
      expect(puzzle.grid).toEqual({ spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true });
      const markup = boardGridMarkup(puzzle.width, puzzle.height, false, puzzle.grid);
      const commands = markup.match(/M /g) ?? [];
      expect(commands).toHaveLength(puzzle.width + puzzle.height + 2);
      expect(markup).toContain(`M ${puzzle.width} 0 V ${puzzle.height}`);
      expect(markup).toContain(`M 0 ${puzzle.height} H ${puzzle.width}`);
      expect(measureNeighborSpacing(puzzle).minimum).toBe(1);
      expect(() => validateLevel(puzzle)).not.toThrow();
      for (const arrow of puzzle.arrows) {
        for (let index = 0; index < arrow.path.length; index += 1) {
          const { x, y } = arrow.path[index];
          expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(puzzle.width);
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(puzzle.height);
          if (index) {
            const dx = Math.abs(x - arrow.path[index - 1].x), dy = Math.abs(y - arrow.path[index - 1].y);
            expect(Math.max(dx, dy)).toBe(1);
            expect(dx === 0 || dy === 0 || dx === dy).toBe(true);
            expect(dx === 0 || dy === 0, `${puzzle.number}/${arrow.id} must remain orthogonal in Round 10`).toBe(true);
          }
        }
      }
    }
    expect(getCuratedLevel(5)?.id).toBe('first-flight-005');
    expect(getCuratedLevelById('first-flight-005')?.number).toBe(5);
    expect(getNextCuratedLevel(CURATED_LEVELS[3])?.id).toBe('first-flight-005');
    expect(getNextCuratedLevel(CURATED_LEVELS[4])?.id).toBe('first-flight-006');
    expect(getNextCuratedLevel(CURATED_LEVELS[5])?.id).toBe('first-flight-007');
    expect(getNextCuratedLevel(CURATED_LEVELS[6])).toBeUndefined();
    expect(CURATED_LEVELS.every(({ catalogVersion, contentVersion, number }) => catalogVersion === 'first-flight-r4-large-grid' && contentVersion === (number === 3 ? 3 : number <= 5 ? 2 : 1))).toBe(true);
    expect(() => validateCuratedLevels()).not.toThrow();
  });

  it('keeps Round 10 route definitions unchanged in its archive', () => {
    expect(round10Catalog.levels.map((entry) => entry.puzzle.arrows.map(({ path }) => path.length - 1))).toEqual([
      [5, 2, 6, 3, 5],
      [6, 4, 4, 2, 3, 3, 2, 2],
      [5, 3, 4, 5, 3, 3, 2, 3, 6, 2],
      [7, 3, 2, 4, 3, 5, 5, 7, 4, 2, 3, 2],
      [7, 3, 2, 5, 3, 5, 5, 7, 4, 2, 3, 2, 2, 2, 3],
    ]);
    const fingerprints = round10Catalog.levels.map(({ puzzle }) => createHash('sha256').update(JSON.stringify(puzzle)).digest('hex'));
    expect(fingerprints).toEqual([
      '190b3fc27952e948ba9da079cb18392d654c026ecf6d11cd5261ff6b9d13ade4',
      '14e6e1dcbf82e4bade2b62d5e5ad2bfe741d7bfdfa8412e972c9916eccfd8cbb',
      'a166c2a94be373622217f26d70cef1632a04122360e308289f3b16f650562081',
      '0f1a6dcf828a7f1cd35f6a1e7d479b683e347e26f21862afa35af8b5d1f3ba33',
      '98e3d082ac926431258f88244fee11b0b7234546ec032c58bfb3399195360187',
    ]);
  });

  it('completes exact reachable-state and gameplay-simulator audits for every arrow', () => {
    const expectedStates = [8, 21, 84, 56, 66];
    const expectedTransitions = [9, 35, 212, 124, 137];
    for (const [index, entry] of CURATED_LEVELS.slice(0, 5).entries()) {
      const puzzle = entry.puzzle;
      const solution = solveLevel(puzzle);
      expect(solution, entry.id).not.toBeNull();
      let remaining = [...puzzle.arrows];
      for (const id of solution!) {
        const moving = remaining.find((arrow) => arrow.id === id)!;
        const stationary = remaining.filter((arrow) => arrow.id !== id);
        expect(simulateMove(moving, stationary, puzzle.width, puzzle.height, puzzle.grid).ok, `${entry.id}/${id}`).toBe(true);
        remaining = stationary;
      }
      expect(remaining).toEqual([]);
      const audit = auditReachableStates(puzzle);
      expect(audit.exact).toBe(true);
      expect(audit.reachableStates).toBe(expectedStates[index]);
      expect(audit.legalTransitions).toBe(expectedTransitions[index]);
      expect(audit.terminalStates).toBe(1);
      expect(audit.initialLegalMoves.length).toBeGreaterThan(0);
      expect(audit.deadlocks).toEqual([]);
      expect(audit.dependencyCycles).toEqual([]);
      const metrics = analyzeLevel(puzzle);
      expect(metrics.blockingDependencies).toBeGreaterThan(0);
      expect(metrics.dependencyDepth).toBeGreaterThanOrEqual(2);
      expect(metrics.initiallyRemovable).toBe(audit.initialLegalMoves.length);
    }
  });

  it('rejects malformed true-grid catalog entries before content can be published', () => {
    const offGrid = CURATED_LEVELS.map((entry, index) => index === 0 ? {
      ...entry, puzzle: { ...entry.puzzle, arrows: [{ ...entry.puzzle.arrows[0], path: [{ x: 0.5, y: 2 }, ...entry.puzzle.arrows[0].path.slice(1)] }] },
    } : entry);
    const legacyGrid = CURATED_LEVELS.map((entry, index) => index === 0 ? { ...entry, puzzle: { ...entry.puzzle, grid: undefined } } : entry);
    const malformedReference = CURATED_LEVELS.map((entry, index) => index === 0 ? { ...entry, chapterId: 'missing-chapter' } : entry);
    expect(() => validateCuratedLevels(offGrid)).toThrow(/not on the 1-unit board grid/i);
    expect(() => validateCuratedLevels(legacyGrid)).toThrow(/true visible-cell grid/i);
    expect(() => validateCuratedLevels(malformedReference)).toThrow(/unknown chapter/i);
  });
});
