import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_LEVELS,
  getAdventureLevelByDisplayNumber,
  getAdventureLevelById,
  getAdventureLevelBySequence,
  getAdventureLevelsInProgressionOrder,
  isAdventureLevelUnlocked,
  validateCatalog,
  type AdventureLevel,
} from '../src/game/catalog';
import { generateLevels, reproduceLegacyLevel } from '../src/game/levels';
import {
  createFreshProgress,
  isAdventureLevelComplete,
  loadProgress,
  markLevelComplete,
  migrateLegacyProgress,
  saveProgress,
  selectAdventureLevel,
  type StorageLike,
} from '../src/game/progress';
import { createRun, loseHeart } from '../src/game/session';
import { completeLevel, pointKey, simulateMove, solveLevel, validateArrow, validateLevel } from '../src/game/rules';
import type { Arrow, Level, SaveData } from '../src/game/types';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('storage unavailable');
    this.values.set(key, value);
  }
}

const arrow: Arrow = {
  id: 'turner', color: '#427a9c',
  path: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
};
const smallLevel: Level = { number: 1, seed: 1, width: 4, height: 2, arrows: [arrow] };
const LEGACY_V1 = 'mirpworks.arrow-adventure.save.v1';
const SAVE_V2 = 'mirpworks.arrow-adventure.save.v2';

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  const serialized = JSON.stringify(value);
  for (let index = 0; index < serialized.length; index += 1) hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

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

  it('checks every advancing body cell, even when the head path is clear', () => {
    const tailBlock: Arrow = { id: 'body-blocker', color: '#df6250', path: [{ x: 1, y: 1 }, { x: 2, y: 1 }] };
    const result = simulateMove(arrow, [tailBlock], smallLevel.width);
    expect(result).toEqual({ ok: false, blockedBy: tailBlock.id });
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

describe('curated catalog and prototype compatibility', () => {
  const expectedPuzzleFingerprints: Record<string, string> = {
    'first-flight-001': 'dd3d57ab', 'first-flight-002': 'b2ef1ca4', 'first-flight-003': 'a9991c6a',
    'first-flight-004': '63a49ef5', 'first-flight-005': '9d436d42', 'first-flight-006': '8e763781',
    'first-flight-007': 'db68be46', 'first-flight-008': '626496fe', 'first-flight-009': '9196b296',
    'first-flight-010': '5842f694',
  };

  it('has ten stable, unique entries with valid references and solvable puzzles', () => {
    expect(ADVENTURE_LEVELS).toHaveLength(10);
    expect(() => validateCatalog(ADVENTURE_LEVELS)).not.toThrow();
    expect(new Set(ADVENTURE_LEVELS.map((entry) => entry.id)).size).toBe(10);
    for (const entry of ADVENTURE_LEVELS) {
      expect(() => validateLevel(entry.puzzle)).not.toThrow();
      expect(solveLevel(entry.puzzle)).not.toBeNull();
    }
  });

  it('requires contiguous progression and rejects malformed catalog metadata', () => {
    expect(() => validateCatalog([])).toThrow(/cannot be empty/);
    expect(() => validateCatalog([{ ...ADVENTURE_LEVELS[0], sequence: 2 }])).toThrow(/contiguous/);
    expect(() => validateCatalog([{ ...ADVENTURE_LEVELS[0], id: '!invalid' }])).toThrow(/stable level ID/);
    expect(() => validateCatalog([{ ...ADVENTURE_LEVELS[0], puzzle: { ...ADVENTURE_LEVELS[0].puzzle, width: 0 }, provenance: { kind: 'authored' } }])).toThrow(/dimensions/);
  });

  it('resolves by stable ID, display number, and progression sequence rather than array index', () => {
    const entry = getAdventureLevelById('first-flight-007')!;
    expect(entry.displayNumber).toBe(7);
    expect(getAdventureLevelByDisplayNumber(7)?.id).toBe(entry.id);
    expect(getAdventureLevelBySequence(7)?.id).toBe(entry.id);
    expect(getAdventureLevelsInProgressionOrder().map((item) => item.sequence)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  });

  it('records future mechanic introduction milestones as metadata only', () => {
    expect(ADVENTURE_LEVELS.every((entry) => entry.mechanicIds.every((mechanic) => mechanic === 'standard-arrow'))).toBe(true);
    expect(() => validateCatalog([{ ...ADVENTURE_LEVELS[0], id: 'early-black-hole', displayNumber: 11, sequence: 11, mechanicIds: ['black-hole'] }])).toThrow(/before its introduction target/);
  });

  it('accepts a literal authored puzzle definition without generator provenance', () => {
    const source = ADVENTURE_LEVELS[0];
    const authored: AdventureLevel = {
      ...source,
      id: 'first-flight-011',
      displayNumber: 11,
      sequence: 11,
      contentVersion: 1,
      provenance: { kind: 'authored', authoringSource: 'designer-draft-11' },
      puzzle: { ...source.puzzle, number: 11 },
    };
    expect(() => validateCatalog([...ADVENTURE_LEVELS, authored])).not.toThrow();
  });

  it('rejects a structurally valid authored puzzle with a cyclic exit deadlock', () => {
    const source = ADVENTURE_LEVELS[0];
    const deadlock: Level = {
      number: 1, seed: 1, width: 5, height: 4,
      arrows: [
        { id: 'a', color: '#df6250', path: [[4,2],[4,3],[3,3],[2,3],[1,3],[0,3],[0,2],[0,1],[1,1]].map(([x,y]) => ({x,y})) },
        { id: 'b', color: '#427a9c', path: [[2,1],[2,2],[3,2]].map(([x,y]) => ({x,y})) },
      ],
    };
    const entry = { ...source, id: 'deadlocked-draft', provenance: { kind: 'authored' as const }, puzzle: deadlock };
    expect(() => validateLevel(deadlock)).not.toThrow();
    expect(solveLevel(deadlock)).toBeNull();
    expect(() => validateCatalog([entry])).toThrow(/no verified solution/);
  });

  it('reproduces all ten frozen original puzzle layouts, paths, and seeds exactly', () => {
    expect(Object.keys(expectedPuzzleFingerprints).sort()).toEqual(ADVENTURE_LEVELS.map((entry) => entry.id).sort());
    const generated = generateLevels();
    expect(generated).toHaveLength(10);
    for (const entry of ADVENTURE_LEVELS) {
      expect(entry.provenance.kind).toBe('generated');
      if (entry.provenance.kind !== 'generated') throw new Error(`${entry.id} lost generator provenance`);
      expect(entry.contentVersion).toBe(1);
      expect(entry.puzzle).toEqual(generated.find((level) => level.number === entry.displayNumber));
      expect(entry.puzzle).toEqual(reproduceLegacyLevel(entry.provenance.seed, entry.displayNumber, entry.puzzle.arrows.length));
      expect(fingerprint(entry.puzzle)).toBe(expectedPuzzleFingerprints[entry.id]);
    }
  });

  it('rejects duplicate IDs/numbers/sequences, unknown chapters, tutorials, mechanics, and invalid metadata', () => {
    const entry = ADVENTURE_LEVELS[0];
    expect(() => validateCatalog([entry, { ...entry, displayNumber: 2, sequence: 2 }])).toThrow(/Duplicate level ID/);
    expect(() => validateCatalog([entry, { ...entry, id: 'another-id', sequence: 2 }])).toThrow(/Duplicate display number/);
    expect(() => validateCatalog([entry, { ...entry, id: 'another-id', displayNumber: 2 }])).toThrow(/Duplicate progression sequence/);
    expect(() => validateCatalog([{ ...entry, chapterId: 'missing-chapter' }])).toThrow(/unknown chapter/);
    expect(() => validateCatalog([{ ...entry, tutorialRef: 'missing-tutorial' }])).toThrow(/unknown tutorial/);
    expect(() => validateCatalog([{ ...entry, mechanicIds: ['time-rewind'] as unknown as AdventureLevel['mechanicIds'] }])).toThrow(/unsupported mechanic/);
    expect(() => validateCatalog([{ ...entry, difficulty: 'impossible' as AdventureLevel['difficulty'] }])).toThrow(/unsupported difficulty/);
    expect(() => validateCatalog([{ ...entry, contentVersion: 0 }])).toThrow(/content version/);
  });
});

describe('save migration and stable-ID progression', () => {
  it('migrates the existing numeric save, preserving completion and unlock state', () => {
    const storage = new MemoryStorage();
    const oldSave = JSON.stringify({ highestUnlocked: 4, completed: [1, 2, 3] });
    storage.setItem(LEGACY_V1, oldSave);

    const migrated = loadProgress(storage);
    expect(migrated).toEqual({
      schemaVersion: 2,
      highestUnlockedLevelId: 'first-flight-004',
      selectedLevelId: 'first-flight-004',
      completedLevelIds: ['first-flight-001', 'first-flight-002', 'first-flight-003'],
    });
    expect(storage.getItem(LEGACY_V1)).toBe(oldSave);
    expect(JSON.parse(storage.getItem(SAVE_V2)!)).toEqual(migrated);
  });

  it('is repeatable and idempotent after the v2 record has been written', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_V1, JSON.stringify({ highestUnlocked: 3, completed: [1, 2] }));
    const first = loadProgress(storage);
    const serialized = storage.getItem(SAVE_V2);
    expect(loadProgress(storage)).toEqual(first);
    expect(storage.getItem(SAVE_V2)).toBe(serialized);
  });

  it('retries migration after a failed v2 write without modifying the v1 source', () => {
    const storage = new MemoryStorage();
    const oldSave = JSON.stringify({ highestUnlocked: 2, completed: [1] });
    storage.setItem(LEGACY_V1, oldSave);
    storage.failWrites = true;
    const migrated = loadProgress(storage);
    expect(migrated.highestUnlockedLevelId).toBe('first-flight-002');
    expect(saveProgress(storage, migrated)).toBe(false);
    expect(storage.getItem(SAVE_V2)).toBeNull();
    expect(storage.getItem(LEGACY_V1)).toBe(oldSave);
    storage.failWrites = false;
    expect(loadProgress(storage).highestUnlockedLevelId).toBe('first-flight-002');
    expect(storage.getItem(SAVE_V2)).not.toBeNull();
  });

  it('handles missing, malformed, and partial legacy data without deleting it or granting progress', () => {
    expect(loadProgress(new MemoryStorage())).toEqual(createFreshProgress());
    for (const raw of ['{bad json', 'null', JSON.stringify({ highestUnlocked: 9, completed: 'all' }), JSON.stringify({ highestUnlocked: 9, completed: [1, 'bad'] })]) {
      const storage = new MemoryStorage();
      storage.setItem(LEGACY_V1, raw);
      expect(loadProgress(storage)).toEqual(createFreshProgress());
      expect(storage.getItem(LEGACY_V1)).toBe(raw);
      expect(storage.getItem(SAVE_V2)).toBeNull();
    }
  });

  it('handles malformed v2 data by falling back safely and constrains selected IDs to unlocked progress', () => {
    const malformed = new MemoryStorage();
    malformed.setItem(SAVE_V2, '{bad json');
    expect(loadProgress(malformed)).toEqual(createFreshProgress());
    expect(malformed.getItem(SAVE_V2)).toBe('{bad json');

    const constrained = new MemoryStorage();
    constrained.setItem(SAVE_V2, JSON.stringify({
      schemaVersion: 2,
      highestUnlockedLevelId: 'first-flight-002',
      selectedLevelId: 'first-flight-009',
      completedLevelIds: ['first-flight-001', 'retired-level-007'],
    }));
    expect(loadProgress(constrained)).toEqual({
      schemaVersion: 2,
      highestUnlockedLevelId: 'first-flight-002',
      selectedLevelId: 'first-flight-002',
      completedLevelIds: ['first-flight-001', 'retired-level-007'],
    });
  });

  it('maps an optional numeric selected level only when it is already unlocked', () => {
    expect(migrateLegacyProgress({ highestUnlocked: 4, completed: [1], selectedLevel: 2 })?.selectedLevelId).toBe('first-flight-002');
    expect(migrateLegacyProgress({ highestUnlocked: 2, completed: [1], selectedLevel: 8 })?.selectedLevelId).toBe('first-flight-002');
    expect(migrateLegacyProgress({ highestUnlocked: 2, completed: [1] })?.selectedLevelId).toBe('first-flight-002');
  });

  it('keeps current-schema selected level and completion state persistent', () => {
    const storage = new MemoryStorage();
    let progress = createFreshProgress();
    progress = markLevelComplete(progress, getAdventureLevelById('first-flight-001')!);
    progress = selectAdventureLevel(progress, 'first-flight-001');
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage)).toEqual(progress);
    expect(selectAdventureLevel(progress, 'first-flight-003')).toEqual(progress);
  });

  it('unlocks by catalog sequence and keeps prior completion credit across a content-version update', () => {
    const first = getAdventureLevelById('first-flight-001')!;
    let progress: SaveData = markLevelComplete(createFreshProgress(), first);
    expect(progress.highestUnlockedLevelId).toBe('first-flight-002');
    expect(isAdventureLevelUnlocked(getAdventureLevelById('first-flight-002')!, progress.highestUnlockedLevelId)).toBe(true);
    expect(isAdventureLevelUnlocked(getAdventureLevelById('first-flight-003')!, progress.highestUnlockedLevelId)).toBe(false);
    const revised = { ...first, contentVersion: 2 };
    expect(isAdventureLevelComplete(progress, revised)).toBe(true);
    progress = markLevelComplete(progress, getAdventureLevelById('first-flight-001')!);
    expect(progress.completedLevelIds).toEqual(['first-flight-001']);
    expect(progress.highestUnlockedLevelId).toBe('first-flight-002');
  });
});

describe('run state', () => {
  it('removes one heart per blocked selection and never drops below zero', () => {
    expect(loseHeart(3)).toBe(2);
    expect(loseHeart(2)).toBe(1);
    expect(loseHeart(1)).toBe(0);
    expect(loseHeart(0)).toBe(0);
  });

  it('restarts a level with its original arrows and three hearts', () => {
    const level = getAdventureLevelById('first-flight-001')!.puzzle;
    const run = createRun(level);
    run.arrows.pop();
    run.hearts = 1;
    const restarted = createRun(level);
    expect(restarted.hearts).toBe(3);
    expect(restarted.arrows).toEqual(level.arrows);
    expect(restarted.arrows).not.toBe(level.arrows);
  });

  it('detects level completion after the last arrow is removed', () => {
    expect(completeLevel([])).toBe(true);
    expect(completeLevel([arrow])).toBe(false);
  });
});
