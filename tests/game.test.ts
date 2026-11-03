import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_LEVELS,
  getAdventureLevelByDisplayNumber,
  getAdventureLevelById,
  getAdventureLevelBySequence,
  getAdventureLevelsInProgressionOrder,
  isAdventureLevelUnlocked,
  reproduceAdventureLevel,
  TUTORIAL_REFERENCES,
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
import { ARROW_STROKE_WIDTH, arrowsCollide, polylinesCollide } from '../src/game/geometry';
import { markTutorialSeen, shouldShowTutorial } from '../src/game/tutorials';
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
    expect(() => validateLevel(overlap)).toThrow(/collides/);
  });

  it('reports failed exits and successful exits distinctly', () => {
    const blocker: Arrow = { id: 'blocker', color: '#df6250', path: [{ x: 3, y: 0 }, { x: 3, y: 1 }] };
    expect(simulateMove(arrow, [blocker], 4, 2).ok).toBe(false);
    expect(simulateMove(arrow, [], 4, 2).ok).toBe(true);
  });

  it('supports up, down, left, and right exits while following the winding body', () => {
    const examples: Array<{ direction: string; arrow: Arrow; width: number; height: number }> = [
      { direction: 'east', arrow, width: 4, height: 2 },
      { direction: 'west', arrow: { ...arrow, id: 'left', path: [{x:3,y:1},{x:2,y:1},{x:2,y:0},{x:1,y:0}] }, width: 4, height: 2 },
      { direction: 'south', arrow: { ...arrow, id: 'down', path: [{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}] }, width: 3, height: 4 },
      { direction: 'north', arrow: { ...arrow, id: 'up', path: [{x:2,y:3},{x:2,y:2},{x:1,y:2},{x:1,y:1}] }, width: 4, height: 4 },
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
      if (example.direction === 'east') expect(lastFrame.every((point) => point.x >= example.width)).toBe(true);
      if (example.direction === 'west') expect(lastFrame.every((point) => point.x < 0)).toBe(true);
      if (example.direction === 'south') expect(lastFrame.every((point) => point.y >= example.height)).toBe(true);
      if (example.direction === 'north') expect(lastFrame.every((point) => point.y < 0)).toBe(true);

      const head = example.arrow.path.at(-1)!;
      const next = { x: head.x + exitDirection(example.arrow).x, y: head.y + exitDirection(example.arrow).y };
      const side = example.direction === 'east' || example.direction === 'west' ? { x: next.x, y: next.y + 1 } : { x: next.x + 1, y: next.y };
      const blocker: Arrow = { id: `block-${example.direction}`, color: '#df6250', path: [next, side] };
      expect(() => validateLevel({ number: 1, width: example.width, height: example.height, arrows: [example.arrow, blocker] })).not.toThrow();
      expect(simulateMove(example.arrow, [blocker], example.width, example.height)).toEqual({ ok: false, blockedBy: blocker.id });
    }
  });

  it('supports all eight exit headings and mixed cardinal/diagonal path steps', () => {
    const directions = [
      { name: 'east', x: 1, y: 0 }, { name: 'northeast', x: 1, y: -1 },
      { name: 'north', x: 0, y: -1 }, { name: 'northwest', x: -1, y: -1 },
      { name: 'west', x: -1, y: 0 }, { name: 'southwest', x: -1, y: 1 },
      { name: 'south', x: 0, y: 1 }, { name: 'southeast', x: 1, y: 1 },
    ];
    for (const direction of directions) {
      const first = { x: 3, y: 3 };
      const turn = { x: 3 - direction.y, y: 3 + direction.x };
      const head = { x: turn.x + direction.x, y: turn.y + direction.y };
      const mixedArrow: Arrow = { id: `eight-${direction.name}`, color: '#427a9c', path: [first, turn, head] };
      expect(directionName(exitDirection(mixedArrow))).toBe(direction.name);
      expect(() => validateArrow(mixedArrow, 8, 8)).not.toThrow();
      const move = simulateMove(mixedArrow, [], 8, 8);
      expect(move.ok).toBe(true);
      if (!move.ok) continue;
      expect(move.frames[0].slice(0, -1)).toEqual(mixedArrow.path.slice(1));
      expect(move.frames.at(-1)!.every((point) => point.x < 0 || point.x >= 8 || point.y < 0 || point.y >= 8)).toBe(true);
    }
  });

  it('detects diagonal crossings between grid points and cardinal endpoint contacts', () => {
    const rising: Arrow = { id: 'rising', color: '#df6250', path: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const falling: Arrow = { id: 'falling', color: '#427a9c', path: [{ x: 0, y: 1 }, { x: 1, y: 0 }] };
    expect(arrowsCollide(rising, falling)).toBe(true);
    expect(() => validateLevel({ number: 1, width: 4, height: 4, arrows: [rising, falling] })).toThrow(/visually collides/);

    const cardinal: Arrow = { id: 'cardinal', color: '#da9b36', path: [{ x: 1, y: 1 }, { x: 2, y: 1 }] };
    expect(arrowsCollide(rising, cardinal)).toBe(true);
    expect(() => validateLevel({ number: 1, width: 4, height: 4, arrows: [rising, cardinal] })).toThrow(/visually collides/);
  });

  it('includes arrowhead triangles when two otherwise separated bodies face each other', () => {
    const east: Arrow = { id: 'east-head', color: '#df6250', path: [{ x: 0, y: 1 }, { x: 1, y: 1 }] };
    const west: Arrow = { id: 'west-head', color: '#427a9c', path: [{ x: 3, y: 1 }, { x: 2, y: 1 }] };
    expect(polylinesCollide(east.path, west.path)).toBe(false);
    expect(arrowsCollide(east, west)).toBe(true);
    expect(() => validateLevel({ number: 1, width: 4, height: 3, arrows: [east, west] })).toThrow(/visually collides/);
  });

  it('rejects a self-crossing diagonal route even when the crossing is not a grid point', () => {
    const loop: Arrow = { id: 'crossing-loop', color: '#df6250', path: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }] };
    expect(() => validateArrow(loop, 4, 4)).toThrow(/visually self-intersecting/);
  });

  it('blocks a diagonal exit when the moving body crosses a stationary diagonal between points', () => {
    const moving: Arrow = { id: 'moving-se', color: '#df6250', path: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const blocker: Arrow = { id: 'stationary-northeast', color: '#427a9c', path: [{ x: 2, y: 3 }, { x: 3, y: 2 }] };
    const level: Level = { number: 1, width: 5, height: 5, arrows: [moving, blocker] };
    expect(() => validateLevel(level)).not.toThrow();
    expect(simulateMove(moving, [blocker], level.width, level.height)).toEqual({ ok: false, blockedBy: blocker.id });
    expect(solveLevel(level)).toEqual([blocker.id, moving.id]);
  });

  it('uses the visible line width as a collision threshold with a small numeric tolerance', () => {
    const horizontal = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const justInside = [{ x: 0, y: ARROW_STROKE_WIDTH - 1e-9 }, { x: 1, y: ARROW_STROKE_WIDTH - 1e-9 }];
    const justOutside = [{ x: 0, y: ARROW_STROKE_WIDTH + 1e-6 }, { x: 1, y: ARROW_STROKE_WIDTH + 1e-6 }];
    expect(polylinesCollide(horizontal, justInside)).toBe(true);
    expect(polylinesCollide(horizontal, justOutside)).toBe(false);
  });
});

describe('curated catalog and prototype compatibility', () => {
  const expectedPuzzleFingerprints: Record<string, string> = {
    'first-flight-001': 'dd3d57ab', 'first-flight-002': 'b2ef1ca4', 'first-flight-003': 'a9991c6a',
    'first-flight-004': '63a49ef5', 'first-flight-005': '9d436d42', 'first-flight-006': '8e763781',
    'first-flight-007': 'db68be46', 'first-flight-008': '626496fe', 'first-flight-009': '9196b296',
    'first-flight-010': '5842f694',
  };

  it('has forty stable, unique entries with valid references and solvable puzzles', () => {
    expect(ADVENTURE_LEVELS).toHaveLength(40);
    expect(() => validateCatalog(ADVENTURE_LEVELS)).not.toThrow();
    expect(new Set(ADVENTURE_LEVELS.map((entry) => entry.id)).size).toBe(40);
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
    expect(getAdventureLevelsInProgressionOrder().map((item) => item.sequence)).toEqual(Array.from({ length: 40 }, (_, index) => index + 1));
  });

  it('records future mechanic introduction milestones as metadata only', () => {
    expect(ADVENTURE_LEVELS.filter((entry) => entry.sequence <= 20).every((entry) => entry.mechanicIds.every((mechanic) => mechanic === 'standard-arrow'))).toBe(true);
    expect(ADVENTURE_LEVELS.filter((entry) => entry.sequence >= 21).every((entry) => entry.mechanicIds.includes('diagonal-arrow'))).toBe(true);
    expect(TUTORIAL_REFERENCES).toContain('diagonal-movement');
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
    const expanded = ADVENTURE_LEVELS.filter((entry) => entry.sequence >= 11 && entry.sequence <= 20);
    expect(expanded.map((entry) => [entry.id, entry.contentVersion])).toEqual(
      Array.from({ length: 10 }, (_, index) => [`first-flight-${String(index + 11).padStart(3, '0')}`, 1]),
    );
    expect(expanded.every((entry) => entry.provenance.kind === 'authored')).toBe(true);
    const directions = new Set(expanded.flatMap((entry) => entry.puzzle.arrows.map((item) => directionName(exitDirection(item)))));
    expect(directions).toEqual(new Set(['north', 'south', 'east', 'west']));
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

  it('freezes and solver-verifies the twenty diagonal expansion levels', () => {
    const fingerprints: Record<string, string> = {
      'first-flight-021': '511057dd', 'first-flight-022': '819bc00e', 'first-flight-023': '7b893b32', 'first-flight-024': 'b91dbcf7', 'first-flight-025': '47809aef',
      'first-flight-026': 'c347816b', 'first-flight-027': '0b4603a7', 'first-flight-028': '2e0783bd', 'first-flight-029': '80933f46', 'first-flight-030': '8e835297',
      'first-flight-031': '56df26e8', 'first-flight-032': 'b863b95b', 'first-flight-033': 'c0d95859', 'first-flight-034': '6f07c323', 'first-flight-035': '449f5040',
      'first-flight-036': 'c12c552f', 'first-flight-037': '4b148735', 'first-flight-038': '810d3e61', 'first-flight-039': '6dca2b4d', 'first-flight-040': '26b88fc0',
    };
    const expanded = ADVENTURE_LEVELS.filter((entry) => entry.sequence >= 21);
    expect(expanded.map((entry) => [entry.id, entry.contentVersion])).toEqual(
      Array.from({ length: 20 }, (_, index) => [`first-flight-${String(index + 21).padStart(3, '0')}`, 1]),
    );
    expect(expanded.every((entry) => entry.provenance.kind === 'authored' && entry.mechanicIds.includes('diagonal-arrow'))).toBe(true);
    expect(expanded[0].tutorialRef).toBe('diagonal-movement');
    expect(expanded.slice(1).every((entry) => entry.tutorialRef === undefined)).toBe(true);
    for (const entry of expanded) {
      expect(reproduceAdventureLevel(entry)).toEqual(entry.puzzle);
      expect(fingerprint(entry.puzzle)).toBe(fingerprints[entry.id]);
      expect(solveLevel(entry.puzzle)).not.toBeNull();
      expect(entry.puzzle.arrows.some((arrow) => arrow.path.some((point, index) => index > 0 && point.x !== arrow.path[index - 1].x && point.y !== arrow.path[index - 1].y))).toBe(true);
    }
    const lateExitDirections = new Set(expanded.filter((entry) => entry.sequence >= 36).flatMap((entry) => entry.puzzle.arrows.map((arrow) => directionName(exitDirection(arrow)))));
    expect(lateExitDirections).toEqual(new Set(['north','northeast','east','southeast','south','southwest','west','northwest']));
    const safeCount = (entry: AdventureLevel) => entry.puzzle.arrows.filter((arrow) => simulateMove(arrow, entry.puzzle.arrows.filter((other) => other.id !== arrow.id), entry.puzzle.width, entry.puzzle.height).ok).length;
    expect(safeCount(expanded[0])).toBe(3);
    expect(safeCount(expanded[1])).toBe(2);
    expect(Math.max(...expanded.slice(-5).map(safeCount))).toBeLessThanOrEqual(3);
    expect(Math.min(...expanded.slice(-5).map(safeCount))).toBeLessThanOrEqual(2);
    expect(expanded.filter((entry) => entry.sequence >= 31).every((entry) => entry.puzzle.arrows.some((arrow) => {
      const hasCardinal = arrow.path.some((point, index) => index > 0 && (point.x === arrow.path[index - 1].x || point.y === arrow.path[index - 1].y));
      const hasDiagonal = arrow.path.some((point, index) => index > 0 && point.x !== arrow.path[index - 1].x && point.y !== arrow.path[index - 1].y);
      return hasCardinal && hasDiagonal;
    }))).toBe(true);
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

  it('unlocks level 21 after level 20 without changing schema-v2 completion credit', () => {
    const level20 = getAdventureLevelById('first-flight-020')!;
    const prior: SaveData = { schemaVersion: 2, highestUnlockedLevelId: level20.id, selectedLevelId: level20.id, completedLevelIds: ['first-flight-001', 'first-flight-020'] };
    const next = markLevelComplete(prior, level20);
    expect(next.schemaVersion).toBe(2);
    expect(next.highestUnlockedLevelId).toBe('first-flight-021');
    expect(next.completedLevelIds).toEqual(prior.completedLevelIds);
  });
});

describe('one-time mechanic tutorial', () => {
  it('shows the diagonal introduction once and records dismissal outside save schema v2', () => {
    const storage = new MemoryStorage();
    expect(shouldShowTutorial('diagonal-movement', storage)).toBe(true);
    expect(shouldShowTutorial(undefined, storage)).toBe(false);
    markTutorialSeen('diagonal-movement', storage);
    expect(shouldShowTutorial('diagonal-movement', storage)).toBe(false);
    expect(storage.getItem(SAVE_V2)).toBeNull();
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
