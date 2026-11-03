import { describe, expect, it } from 'vitest';
import { generateLevels, LEVELS } from '../src/game/levels';
import { loadProgress, markLevelComplete, saveProgress, type StorageLike } from '../src/game/progress';
import { createRun, loseHeart } from '../src/game/session';
import { completeLevel, pointKey, simulateMove, solveLevel, validateArrow, validateLevel } from '../src/game/rules';
import type { Arrow, Level } from '../src/game/types';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const arrow: Arrow = {
  id: 'turner', color: '#427a9c',
  path: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
};
const smallLevel: Level = { number: 1, seed: 1, width: 4, height: 2, arrows: [arrow] };

describe('arrow geometry and movement', () => {
  it('accepts connected orthogonal paths with a visible east-facing head', () => {
    expect(() => validateArrow(arrow, 4, 2)).not.toThrow();
  });

  it('rejects disconnected paths, self-crossing paths, and invalid exit direction', () => {
    expect(() => validateArrow({ ...arrow, path: [{ x: 0, y: 0 }, { x: 2, y: 0 }] }, 4, 2)).toThrow(/disconnected/);
    expect(() => validateArrow({ ...arrow, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }] }, 4, 2)).toThrow(/crosses itself/);
    expect(() => validateArrow({ ...arrow, path: [{ x: 1, y: 0 }, { x: 0, y: 0 }] }, 4, 2)).toThrow(/face east/);
  });

  it('advances the winding body in path order and clears the whole arrow off board', () => {
    const result = simulateMove(arrow, [], smallLevel.width);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames[0]).toEqual([
      { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
    ]);
    expect(result.frames.at(-1)!.every((point) => point.x >= smallLevel.width)).toBe(true);
    expect(result.frames.length).toBeGreaterThan(arrow.path.length);
  });

  it('fails when any cell in the advancing body overlaps a blocker, even if the new head is clear', () => {
    const tailBlock: Arrow = { id: 'body-blocker', color: '#df6250', path: [{ x: 1, y: 1 }, { x: 2, y: 1 }] };
    const result = simulateMove(arrow, [tailBlock], smallLevel.width);
    expect(result).toEqual({ ok: false, blockedBy: tailBlock.id });
    // The new head would be at 3,0 (clear); the overlap is under the trailing body at 1,1.
    expect(pointKey({ x: 3, y: 0 })).not.toBe(pointKey(tailBlock.path[0]));
  });

  it('rejects illegal overlaps in actual puzzle definitions', () => {
    const overlap: Level = { ...smallLevel, arrows: [arrow, { ...arrow, id: 'other' }] };
    expect(() => validateLevel(overlap)).toThrow(/overlaps/);
  });

  it('reports failed exits and successful exits distinctly', () => {
    const blocker: Arrow = { id: 'blocker', color: '#df6250', path: [{ x: 3, y: 0 }, { x: 4, y: 0 }] };
    expect(simulateMove(arrow, [blocker], 4).ok).toBe(false);
    expect(simulateMove(arrow, [], 4).ok).toBe(true);
  });
});

describe('level generation and solving', () => {
  it('creates exactly ten deterministic, valid levels and verifies a solution for each', () => {
    expect(LEVELS).toHaveLength(10);
    expect(generateLevels()).toEqual(LEVELS);
    for (const level of LEVELS) {
      expect(() => validateLevel(level)).not.toThrow();
      expect(solveLevel(level)).not.toBeNull();
    }
  });

  it('uses distinct cells and increases arrow counts across the set', () => {
    for (let index = 0; index < LEVELS.length; index += 1) {
      expect(LEVELS[index].arrows.length).toBeGreaterThan(index === 0 ? 0 : LEVELS[index - 1].arrows.length);
    }
  });
});

describe('run state and progress', () => {
  it('removes one heart per blocked selection and never drops below zero', () => {
    expect(loseHeart(3)).toBe(2);
    expect(loseHeart(2)).toBe(1);
    expect(loseHeart(1)).toBe(0);
    expect(loseHeart(0)).toBe(0);
  });

  it('restarts a level with its original arrows and three hearts', () => {
    const run = createRun(LEVELS[0]);
    run.arrows.pop();
    run.hearts = 1;
    const restarted = createRun(LEVELS[0]);
    expect(restarted.hearts).toBe(3);
    expect(restarted.arrows).toEqual(LEVELS[0].arrows);
    expect(restarted.arrows).not.toBe(LEVELS[0].arrows);
  });

  it('detects level completion after the last arrow is removed', () => {
    expect(completeLevel([])).toBe(true);
    expect(completeLevel([arrow])).toBe(false);
  });

  it('saves, unlocks, reloads, and sanitizes local progress', () => {
    const storage = new MemoryStorage();
    const fresh = loadProgress(storage);
    expect(fresh).toEqual({ highestUnlocked: 1, completed: [] });
    const won = markLevelComplete(fresh, 1);
    saveProgress(storage, won);
    expect(loadProgress(storage)).toEqual({ highestUnlocked: 2, completed: [1] });
    storage.setItem('mirpworks.arrow-adventure.save.v1', '{bad json');
    expect(loadProgress(storage)).toEqual({ highestUnlocked: 1, completed: [] });
  });
});
