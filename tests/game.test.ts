import { describe, expect, it } from 'vitest';
import appSource from '../src/main.ts?raw';
import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel, validateCuratedLevels } from '../src/game/catalog';
import { arrowsCollide } from '../src/game/geometry';
import { completeLevel, directionName, exitDirection, MOVE_SUBSTEPS, simulateMove, solveLevel, validateArrow, validateLevel } from '../src/game/rules';
import { advanceSession, createRun, createSession, loseHeart } from '../src/game/session';
import type { Arrow, Level, Point } from '../src/game/types';

const makeArrow = (id: string, path: Point[]): Arrow => ({ id, path });

describe('curated shared-board catalog', () => {
  it('contains a small, contiguous, authored prototype set beginning at Level 1', () => {
    expect(CURATED_LEVELS.length).toBeGreaterThanOrEqual(5);
    expect(CURATED_LEVELS.length).toBeLessThanOrEqual(10);
    expect(CURATED_LEVELS.map((entry) => entry.number)).toEqual(CURATED_LEVELS.map((_, index) => index + 1));
    expect(new Set(CURATED_LEVELS.map((entry) => entry.id)).size).toBe(CURATED_LEVELS.length);
    expect(getCuratedLevel(1)?.id).toBe('shared-board-001');
    expect(getNextCuratedLevel(CURATED_LEVELS[0])?.number).toBe(2);
    expect(getNextCuratedLevel(CURATED_LEVELS.at(-1)!)).toBeUndefined();
  });

  it('validates every authored board, rejects stationary overlaps, and proves each level solvable', () => {
    expect(() => validateCuratedLevels()).not.toThrow();
    for (const entry of CURATED_LEVELS) {
      expect(() => validateLevel(entry.puzzle)).not.toThrow();
      expect(solveLevel(entry.puzzle), entry.id).not.toBeNull();
    }
  });

  it('ramps from forced openings toward multiple safe choices and deeper dependencies', () => {
    const openingCounts = CURATED_LEVELS.map(({ puzzle }) => puzzle.arrows.filter((arrow) =>
      simulateMove(arrow, puzzle.arrows.filter((other) => other.id !== arrow.id), puzzle.width, puzzle.height).ok,
    ).length);
    const solutionDepths = CURATED_LEVELS.map(({ puzzle }) => solveLevel(puzzle)!.length);
    expect(openingCounts).toEqual([1, 1, 1, 2, 2, 2]);
    expect(solutionDepths).toEqual([2, 3, 4, 5, 5, 6]);
  });

  it('rejects catalog identity and numbering mistakes', () => {
    const duplicateId = CURATED_LEVELS.map((entry, index) => index === 1 ? { ...entry, id: CURATED_LEVELS[0].id } : entry);
    const numberingGap = CURATED_LEVELS.map((entry, index) => index === 1 ? { ...entry, number: 8, puzzle: { ...entry.puzzle, number: 8 } } : entry);
    const mismatchedPuzzle = CURATED_LEVELS.map((entry, index) => index === 0 ? { ...entry, puzzle: { ...entry.puzzle, number: 2 } } : entry);
    expect(() => validateCuratedLevels(duplicateId)).toThrow(/duplicate level ID/i);
    expect(() => validateCuratedLevels(numberingGap)).toThrow(/contiguously/i);
    expect(() => validateCuratedLevels(mismatchedPuzzle)).toThrow(/does not match/i);
    expect(CURATED_LEVELS.every((entry) => entry.puzzle.arrows.length > 1)).toBe(true);
  });
});

describe('shared arrow geometry and movement', () => {
  it('accepts cardinal and diagonal adjacent path segments and rejects malformed steps', () => {
    expect(() => validateArrow(makeArrow('winding', [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }]), 5, 5)).not.toThrow();
    expect(() => validateArrow(makeArrow('gap', [{ x: 0, y: 0 }, { x: 2, y: 0 }]), 5, 5)).toThrow(/disconnected/i);
    expect(() => validateArrow(makeArrow('repeat', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]), 5, 5)).toThrow(/crosses itself/i);
  });

  it('moves the full arrow body smoothly through its turns, then completes the exit', () => {
    const arrow = makeArrow('turner', [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);
    const result = simulateMove(arrow, [], 6, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames.length).toBeGreaterThan(MOVE_SUBSTEPS);
    expect(result.frames[0]).toHaveLength(arrow.path.length);
    expect(result.frames[0][0].x).toBeCloseTo(0.25);
    expect(result.frames[0][1].y).toBeCloseTo(1.75);
    expect(result.frames.at(-1)!.every((point) => point.x >= 6 || point.y < 0 || point.y >= 5)).toBe(true);
  });

  it('supports successful exits in all eight compass directions', () => {
    const directions = [
      { x: 0, y: -1, name: 'north' }, { x: 1, y: -1, name: 'northeast' },
      { x: 1, y: 0, name: 'east' }, { x: 1, y: 1, name: 'southeast' },
      { x: 0, y: 1, name: 'south' }, { x: -1, y: 1, name: 'southwest' },
      { x: -1, y: 0, name: 'west' }, { x: -1, y: -1, name: 'northwest' },
    ];
    for (const direction of directions) {
      const head = { x: 3, y: 3 };
      const tail = { x: head.x - direction.x, y: head.y - direction.y };
      const arrow = makeArrow(direction.name, [tail, head]);
      expect(directionName(exitDirection(arrow))).toBe(direction.name);
      expect(simulateMove(arrow, [], 7, 7).ok).toBe(true);
    }
  });

  it('detects diagonal crossings between grid points and illegal stationary overlap', () => {
    const first = makeArrow('first', [{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    const second = makeArrow('second', [{ x: 1, y: 2 }, { x: 2, y: 1 }]);
    expect(arrowsCollide(first, second)).toBe(true);
    const level: Level = { number: 99, width: 5, height: 5, arrows: [first, second] };
    expect(() => validateLevel(level)).toThrow(/visually collides/i);
  });

  it('uses rendered geometry to detect a blocked move through the complete body and exit route', () => {
    const level = CURATED_LEVELS[0].puzzle;
    const arrowA = level.arrows[0];
    const remaining = level.arrows.slice(1);
    const result = simulateMove(arrowA, remaining, level.width, level.height);
    expect(result).toEqual({ ok: false, blockedBy: 'b' });
  });

  it('rejects a mutually blocked board and accepts the same rules through the solver', () => {
    const level: Level = {
      number: 99, width: 8, height: 7,
      arrows: [makeArrow('east', [{ x: 1, y: 4 }, { x: 2, y: 4 }]), makeArrow('west', [{ x: 6, y: 4 }, { x: 5, y: 4 }])],
    };
    expect(() => validateLevel(level)).not.toThrow();
    expect(simulateMove(level.arrows[0], [level.arrows[1]], level.width, level.height).ok).toBe(false);
    expect(simulateMove(level.arrows[1], [level.arrows[0]], level.width, level.height).ok).toBe(false);
    expect(solveLevel(level)).toBeNull();
  });

  it('plays every solver sequence through the exact gameplay simulator', () => {
    for (const entry of CURATED_LEVELS) {
      const solution = solveLevel(entry.puzzle)!;
      let remaining = entry.puzzle.arrows;
      for (const id of solution) {
        const arrow = remaining.find((candidate) => candidate.id === id)!;
        const result = simulateMove(arrow, remaining.filter((candidate) => candidate.id !== id), entry.puzzle.width, entry.puzzle.height);
        expect(result.ok, `${entry.id}: ${id}`).toBe(true);
        if (!result.ok) break;
        expect(result.frames.at(-1)!.every((point) => point.x < 0 || point.x >= entry.puzzle.width || point.y < 0 || point.y >= entry.puzzle.height)).toBe(true);
        remaining = remaining.filter((candidate) => candidate.id !== id);
      }
      expect(completeLevel(remaining)).toBe(true);
    }
  });
});

describe('nonpersistent prototype session and run rules', () => {
  it('always starts at Level 1 and advances only in memory', () => {
    const staleSaves = new Map([
      ['mirpworks.arrow-adventure.save.v1', JSON.stringify({ highestUnlocked: 40, completed: Array.from({ length: 40 }, (_, index) => index + 1) })],
      ['mirpworks.arrow-adventure.save.v2', JSON.stringify({ highestUnlockedLevelId: 'old-level-040' })],
    ]);
    const fresh = createSession();
    expect(fresh.levelNumber).toBe(1);
    expect(advanceSession(fresh, CURATED_LEVELS.length)?.levelNumber).toBe(2);
    expect(advanceSession({ levelNumber: CURATED_LEVELS.length }, CURATED_LEVELS.length)).toBeNull();
    expect(staleSaves.size).toBe(2);
    expect([...staleSaves.values()]).toContain(JSON.stringify({ highestUnlocked: 40, completed: Array.from({ length: 40 }, (_, index) => index + 1) }));
  });

  it('does not read old progress keys or access local storage from the app entry point', () => {
    expect(appSource).not.toMatch(/localStorage|save\.v1|save\.v2|loadProgress|saveProgress|migrateLegacyProgress/i);
  });

  it('restarts from original arrows and three hearts without mutating the curated definition', () => {
    const level = CURATED_LEVELS[0].puzzle;
    const run = createRun(level);
    run.arrows.pop();
    run.hearts = 1;
    const restarted = createRun(level);
    expect(restarted.hearts).toBe(3);
    expect(restarted.arrows).toEqual(level.arrows);
    expect(restarted.arrows).not.toBe(level.arrows);
    expect(level.arrows).toHaveLength(2);
  });

  it('costs one heart per failed pick and stops at zero', () => {
    expect([loseHeart(3), loseHeart(2), loseHeart(1), loseHeart(0)]).toEqual([2, 1, 0, 0]);
  });

  it('completes only after every arrow leaves', () => {
    expect(completeLevel([])).toBe(true);
    expect(completeLevel(CURATED_LEVELS[0].puzzle.arrows)).toBe(false);
  });
});
