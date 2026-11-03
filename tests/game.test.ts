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
import { completeLevel, directionName, exitDirection, pointKey, simulateMove, solveLevel, validateArrow, validateLevel } from '../src/game/rules';
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

  it('rejects disconnected/self-crossing paths and accepts any cardinal-facing head', () => {
    expect(() => validateArrow({ ...arrow, path: [{ x: 0, y: 0 }, { x: 2, y: 0 }] }, 4, 2)).toThrow(/disconnected/);
    expect(() => validateArrow({ ...arrow, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }] }, 4, 2)).toThrow(/crosses itself/);
    for (const path of [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 1, y: 0 }, { x: 0, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      [{ x: 0, y: 1 }, { x: 0, y: 0 }],
    ]) expect(() => validateArrow({ ...arrow, path }, 4, 2)).not.toThrow();
  });

  it('advances the winding body in path order and clears the whole arrow off board', () => {
    const result = simulateMove(arrow, [], smallLevel.width, smallLevel.height);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames[0]).toEqual([
      { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
    ]);
    expect(result.frames.at(-1)!.every((point) => point.x >= smallLevel.width)).toBe(true);
    expect(result.frames.length).toBeGreaterThan(arrow.path.length);
  });

  it('checks every occupied cell of each advancing body frame against legal stationary paths', () => {
    const exitBlocker: Arrow = { id: 'exit-blocker', color: '#df6250', path: [{ x: 3, y: 0 }, { x: 3, y: 1 }] };
    const result = simulateMove(arrow, [exitBlocker], smallLevel.width, smallLevel.height);
    expect(result).toEqual({ ok: false, blockedBy: exitBlocker.id });
    expect(arrow.path.some((point) => exitBlocker.path.some((block) => pointKey(block) === pointKey(point)))).toBe(false);
  });

  it('rejects illegal overlaps in actual puzzle definitions', () => {
    const overlap: Level = { ...smallLevel, arrows: [arrow, { ...arrow, id: 'other' }] };
    expect(() => validateLevel(overlap)).toThrow(/overlaps/);
  });

  it('reports failed exits and successful exits distinctly', () => {
    const blocker: Arrow = { id: 'blocker', color: '#df6250', path: [{ x: 3, y: 0 }, { x: 3, y: 1 }] };
    expect(simulateMove(arrow, [blocker], 4, 2).ok).toBe(false);
    expect(simulateMove(arrow, [], 4, 2).ok).toBe(true);
  });

  it('supports up, down, left, and right exits while following the winding body', () => {
    const examples: Array<{ direction: string; arrow: Arrow; width: number; height: number }> = [
      { direction: 'right', arrow, width: 4, height: 2 },
      { direction: 'left', arrow: { ...arrow, id: 'left', path: [{x:3,y:1},{x:2,y:1},{x:2,y:0},{x:1,y:0}] }, width: 4, height: 2 },
      { direction: 'down', arrow: { ...arrow, id: 'down', path: [{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}] }, width: 3, height: 4 },
      { direction: 'up', arrow: { ...arrow, id: 'up', path: [{x:2,y:3},{x:2,y:2},{x:1,y:2},{x:1,y:1}] }, width: 4, height: 4 },
    ];
    for (const example of examples) {
      expect(directionName(exitDirection(example.arrow))).toBe(example.direction);
      expect(() => validateArrow(example.arrow, example.width, example.height)).not.toThrow();
      const result = simulateMove(example.arrow, [], example.width, example.height);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const firstFrame = result.frames[0];
      expect(firstFrame.slice(0, -1)).toEqual(example.arrow.path.slice(1));
      const lastFrame = result.frames.at(-1)!;
      if (example.direction === 'right') expect(lastFrame.every((point) => point.x >= example.width)).toBe(true);
      if (example.direction === 'left') expect(lastFrame.every((point) => point.x < 0)).toBe(true);
      if (example.direction === 'down') expect(lastFrame.every((point) => point.y >= example.height)).toBe(true);
      if (example.direction === 'up') expect(lastFrame.every((point) => point.y < 0)).toBe(true);

      const head = example.arrow.path.at(-1)!;
      const next = { x: head.x + exitDirection(example.arrow).x, y: head.y + exitDirection(example.arrow).y };
      const side = example.direction === 'right' || example.direction === 'left' ? { x: next.x, y: next.y + 1 } : { x: next.x + 1, y: next.y };
      const blocker: Arrow = { id: `block-${example.direction}`, color: '#df6250', path: [next, side] };
      expect(() => validateLevel({ number: 1, width: example.width, height: example.height, arrows: [example.arrow, blocker] })).not.toThrow();
      expect(simulateMove(example.arrow, [blocker], example.width, example.height)).toEqual({ ok: false, blockedBy: blocker.id });
    }
  });
});

describe('curated catalog and prototype compatibility', () => {
  const expectedPuzzleFingerprints: Record<string, string> = {
    'first-flight-001': 'dd3d57ab', 'first-flight-002': 'b2ef1ca4', 'first-flight-003': 'a9991c6a',
    'first-flight-004': '63a49ef5', 'first-flight-005': '9d436d42', 'first-flight-006': '8e763781',
    'first-flight-007': 'db68be46', 'first-flight-008': '626496fe', 'first-flight-009': '9196b296',
    'first-flight-010': '5842f694',
  };

  it('has twenty stable, unique entries with valid references and solvable puzzles', () => {
    expect(ADVENTURE_LEVELS).toHaveLength(20);
    expect(() => validateCatalog(ADVENTURE_LEVELS)).not.toThrow();
    expect(new Set(ADVENTURE_LEVELS.map((entry) => entry.id)).size).toBe(20);
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
    expect(getAdventureLevelsInProgressionOrder().map((item) => item.sequence)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });

  it('records future mechanic introduction milestones as metadata only', () => {
    expect(ADVENTURE_LEVELS.every((entry) => entry.mechanicIds.every((mechanic) => mechanic === 'standard-arrow'))).toBe(true);
    expect(() => validateCatalog([{ ...ADVENTURE_LEVELS[0], id: 'early-black-hole', displayNumber: 11, sequence: 11, mechanicIds: ['black-hole'] }])).toThrow(/before its introduction target/);
  });

  it('accepts a literal authored puzzle definition without generator provenance', () => {
    const source = ADVENTURE_LEVELS[0];
    const authored: AdventureLevel = {
      ...source,
      id: 'authored-draft-011',
      displayNumber: 11,
      sequence: 1,
      contentVersion: 1,
      provenance: { kind: 'authored', authoringSource: 'designer-draft-11' },
      puzzle: { ...source.puzzle, number: 11 },
    };
    expect(() => validateCatalog([authored])).not.toThrow();
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

  it('adds ten frozen, solver-verified directional variety levels', () => {
    const fingerprints: Record<string, string> = {
      'first-flight-011': '8684dbe6', 'first-flight-012': '29ba2dd6', 'first-flight-013': '090b92b1',
      'first-flight-014': 'c4ad8897', 'first-flight-015': 'bec4e165', 'first-flight-016': 'c89cc87a',
      'first-flight-017': '5378f8bf', 'first-flight-018': 'c266c2e2', 'first-flight-019': 'ec759ebd',
      'first-flight-020': 'a68596a0',
    };
    const expanded = ADVENTURE_LEVELS.filter((entry) => entry.sequence >= 11);
    expect(expanded.map((entry) => [entry.id, entry.contentVersion])).toEqual(
      Array.from({ length: 10 }, (_, index) => [`first-flight-${String(index + 11).padStart(3, '0')}`, 1]),
    );
    expect(expanded.every((entry) => entry.provenance.kind === 'authored')).toBe(true);
    const directions = new Set(expanded.flatMap((entry) => entry.puzzle.arrows.map((item) => directionName(exitDirection(item)))));
    expect(directions).toEqual(new Set(['up', 'down', 'left', 'right']));
    const pathLengths = expanded.flatMap((entry) => entry.puzzle.arrows.map((item) => item.path.length));
    expect(Math.max(...pathLengths)).toBeGreaterThan(Math.min(...pathLengths) + 2);
    for (const entry of expanded) {
      expect(solveLevel(entry.puzzle)).not.toBeNull();
      expect(fingerprint(entry.puzzle)).toBe(fingerprints[entry.id]);
    }
    const openingSafeCount = (number: number) => {
      const puzzle = getAdventureLevelByDisplayNumber(number)!.puzzle;
      return puzzle.arrows.filter((arrow) => simulateMove(
        arrow,
        puzzle.arrows.filter((other) => other.id !== arrow.id),
        puzzle.width,
        puzzle.height,
      ).ok).length;
    };
    expect(openingSafeCount(18)).toBe(2);
    expect(openingSafeCount(19)).toBe(1);
    expect(openingSafeCount(20)).toBe(3);
  });

  it('reproduces all ten frozen original puzzle layouts, paths, and seeds exactly', () => {
    expect(Object.keys(expectedPuzzleFingerprints).sort()).toEqual(ADVENTURE_LEVELS.slice(0, 10).map((entry) => entry.id).sort());
    const generated = generateLevels();
    expect(generated).toHaveLength(10);
    for (const entry of ADVENTURE_LEVELS.slice(0, 10)) {
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

  it('preserves a legacy player at level 10 without unlocking the newly added level early', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_V1, JSON.stringify({ highestUnlocked: 10, completed: [1, 2, 3, 4, 5, 6, 7, 8, 9] }));
    const migrated = loadProgress(storage);
    expect(migrated.highestUnlockedLevelId).toBe('first-flight-010');
    expect(migrated.selectedLevelId).toBe('first-flight-010');
    expect(migrated.completedLevelIds).toHaveLength(9);
    expect(isAdventureLevelUnlocked(getAdventureLevelById('first-flight-010')!, migrated.highestUnlockedLevelId)).toBe(true);
    expect(isAdventureLevelUnlocked(getAdventureLevelById('first-flight-011')!, migrated.highestUnlockedLevelId)).toBe(false);
    expect(storage.getItem(LEGACY_V1)).not.toBeNull();
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

  it('unlocks level 11 after level 10 without changing earlier credit or save schema', () => {
    const level10 = getAdventureLevelById('first-flight-010')!;
    const prior: SaveData = {
      schemaVersion: 2,
      highestUnlockedLevelId: level10.id,
      selectedLevelId: level10.id,
      completedLevelIds: ['first-flight-001', 'first-flight-005', level10.id],
    };
    const next = markLevelComplete(prior, level10);
    expect(next.schemaVersion).toBe(2);
    expect(next.highestUnlockedLevelId).toBe('first-flight-011');
    expect(next.completedLevelIds).toEqual(prior.completedLevelIds);
    expect(isAdventureLevelUnlocked(getAdventureLevelById('first-flight-011')!, next.highestUnlockedLevelId)).toBe(true);
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
