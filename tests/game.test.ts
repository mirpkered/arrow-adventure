import { afterEach, describe, expect, it, vi } from 'vitest';
import appSource from '../src/main.ts?raw';
import qaSource from '../src/qa/qaPanel.ts?raw';
import { bindLongPress } from '../src/qa/qaPanel';
import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel, validateCuratedLevels } from '../src/game/catalog';
import { ARROW_STROKE_WIDTH, arrowsCollide } from '../src/game/geometry';
import { analyzeLevel, completeLevel, directionName, exitDirection, MOVE_SUBSTEPS, movedPathIsOffBoard, moveArrowDistance, nearestArrowAt, simulateMove, solveLevel, TOUCH_PICK_RADIUS, validateArrow, validateLevel } from '../src/game/rules';
import { advanceSession, createRun, createSession, loseHeart } from '../src/game/session';
import { createActionGate } from '../src/game/input';
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

  it('keeps all six boards legal and solvable at every selectable visible stroke width', () => {
    for (const width of [0.12, 0.15, 0.18]) {
      for (const entry of CURATED_LEVELS) {
        expect(() => validateLevel(entry.puzzle, width)).not.toThrow();
        expect(solveLevel(entry.puzzle, width), `${entry.id} at ${width}`).not.toBeNull();
      }
    }
    expect(ARROW_STROKE_WIDTH).toBe(0.15);
  });

  it('ramps from forced openings toward multiple safe choices and deeper dependencies', () => {
    const openingCounts = CURATED_LEVELS.map(({ puzzle }) => puzzle.arrows.filter((arrow) =>
      simulateMove(arrow, puzzle.arrows.filter((other) => other.id !== arrow.id), puzzle.width, puzzle.height).ok,
    ).length);
    const solutionDepths = CURATED_LEVELS.map(({ puzzle }) => solveLevel(puzzle)!.length);
    expect(openingCounts).toEqual([1, 1, 1, 1, 1, 1]);
    expect(solutionDepths).toEqual([3, 4, 4, 5, 5, 6]);
    const metrics = CURATED_LEVELS.map(({ puzzle }) => analyzeLevel(puzzle));
    expect(metrics.map(({ interleavedPairs }) => interleavedPairs)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(metrics.map(({ closeSegmentContacts }) => closeSegmentContacts)).toEqual([22, 8, 25, 11, 8, 16]);
    expect(metrics.map(({ dependencyDepth }) => dependencyDepth)).toEqual([3, 4, 4, 5, 5, 6]);
    expect(metrics.map(({ newlyUnlockedByRemoval }) => newlyUnlockedByRemoval)).toEqual([[1], [1], [1], [1], [1], [1]]);
    expect(metrics.every(({ newlyUnlockedByRemoval }) => newlyUnlockedByRemoval.some((count) => count > 0))).toBe(true);
    expect(CURATED_LEVELS[4].puzzle.arrows.some(({ path }) => path.some((point, index) => index > 0
      && Math.abs(point.x - path[index - 1].x) === 1 && Math.abs(point.y - path[index - 1].y) === 1))).toBe(true);
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

  it('rejects a solvable but visually separated candidate instead of relying on box overlap', () => {
    const separated = CURATED_LEVELS.map((entry, index) => index === 0 ? {
      ...entry,
      puzzle: { number: 1, width: 10, height: 8, arrows: [
        makeArrow('a', [{ x: 0, y: 0 }, { x: 1, y: 0 }]),
        makeArrow('b', [{ x: 0, y: 3 }, { x: 1, y: 3 }]),
        makeArrow('c', [{ x: 0, y: 6 }, { x: 1, y: 6 }]),
      ] },
    } : entry);
    expect(() => validateCuratedLevels(separated)).toThrow(/spatially separated/i);
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
    expect(result.frames[0][0].x).toBeCloseTo(0.05);
    expect(result.frames[0][1].y).toBeCloseTo(2);
    expect(result.travelDistance).toBeGreaterThan(0);
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

  it('does not mistake a winding body straddling different board edges for a completed exit', () => {
    expect(movedPathIsOffBoard([[{ x: -1, y: 3 }, { x: 5, y: 3 }]], 6, 6)).toBe(false);
    expect(movedPathIsOffBoard([[{ x: 5.8, y: 3 }, { x: 6, y: 3 }]], 6, 6)).toBe(true);
  });

  it('interpolates by route distance and pulls the body through the same winding route', () => {
    const arrow = makeArrow('thread', [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);
    const half = moveArrowDistance(arrow, 0.5);
    expect(half[0].x).toBeCloseTo(1);
    expect(half[1].x).toBeCloseTo(1.5);
    expect(half[1].y).toBeCloseTo(2.5);
    expect(half).toContainEqual({ x: 1.5, y: 1.5 }); // The corner remains on the rendered route.
    const afterCorner = moveArrowDistance(arrow, 1.5);
    expect(afterCorner[0].x).toBeCloseTo(1.5);
    expect(afterCorner[0].y).toBeCloseTo(2);
    expect(afterCorner[1].x).toBeCloseTo(1.5);
    expect(afterCorner[1].y).toBeCloseTo(1.5);
  });

  it('chooses the nearest path on the first pointer action and resolves ties consistently', () => {
    const near = makeArrow('a-near', [{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    const far = makeArrow('z-far', [{ x: 1, y: 2 }, { x: 2, y: 2 }]);
    expect(nearestArrowAt({ x: 1.5, y: 1.58 }, [far, near])).toBe('a-near');
    expect(nearestArrowAt({ x: 1.5, y: 1.5 }, [far, near])).toBe('a-near');
    expect(nearestArrowAt({ x: 8, y: 8 }, [near, far])).toBeUndefined();
    expect(TOUCH_PICK_RADIUS * 2).toBeGreaterThanOrEqual(1.5);
  });

  it('uses board pointerdown and requestAnimationFrame without rebuilding the board each frame', () => {
    expect(appSource).toMatch(/addEventListener\('pointerdown'/);
    expect(appSource).toMatch(/requestAnimationFrame\(animate\)/);
    expect(appSource).not.toMatch(/setTimeout\(resolve,\s*16\)/);
    expect(appSource).toMatch(/let animationToken = 0/);
    expect(appSource).toMatch(/animationToken \+= 1/);
    expect(appSource).toMatch(/token !== animationToken/);
    expect(appSource).toMatch(/if \(busy \|\| view !== 'game'\) return/);
    expect(appSource.match(/hearts = loseHeart\(hearts\)/g)).toHaveLength(1);
    expect(appSource).toContain('actionGate.accept(performance.now())');
    expect(appSource).toContain("addEventListener('pointerdown'");
    expect(appSource).toMatch(/if \(action === 'restart'\) startLevel\(catalogEntry\.number\)/);
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
        expect(result.travelDistance).toBeGreaterThan(0);
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
    expect(level.arrows).toHaveLength(CURATED_LEVELS[0].puzzle.arrows.length);
  });

  it('costs one heart per failed pick and stops at zero', () => {
    expect([loseHeart(3), loseHeart(2), loseHeart(1), loseHeart(0)]).toEqual([2, 1, 0, 0]);
  });

  it('completes only after every arrow leaves', () => {
    expect(completeLevel([])).toBe(true);
    expect(completeLevel(CURATED_LEVELS[0].puzzle.arrows)).toBe(false);
  });
});

describe('QA presentation controls and mobile shell', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const fakeTarget = () => {
    const listeners = new Map<string, (event: never) => void>();
    const target = {
      classList: { add: vi.fn(), remove: vi.fn() },
      addEventListener: (type: string, fn: (event: never) => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
      dispatch: (type: string, event: object) => listeners.get(type)?.(event as never),
    };
    return target;
  };

  it('opens QA settings only after a full two-second hold and cancels early releases', () => {
    vi.useFakeTimers();
    const timerWindow = { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) };
    vi.stubGlobal('window', timerWindow);
    const target = fakeTarget(); const open = vi.fn();
    bindLongPress(target as unknown as HTMLElement, open);
    target.dispatch('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 20, clientY: 30, button: 0 });
    vi.advanceTimersByTime(1999); expect(open).not.toHaveBeenCalled();
    target.dispatch('pointerup', { pointerId: 1 }); vi.advanceTimersByTime(50);
    expect(open).not.toHaveBeenCalled();
    target.dispatch('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 2, clientX: 20, clientY: 30, button: 0 });
    vi.advanceTimersByTime(2000); expect(open).toHaveBeenCalledTimes(1);
  });

  it('cancels a QA hold when the pointer moves and supports keyboard activation', () => {
    vi.useFakeTimers();
    const timerWindow = { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) };
    vi.stubGlobal('window', timerWindow);
    const target = fakeTarget(); const open = vi.fn();
    bindLongPress(target as unknown as HTMLElement, open);
    target.dispatch('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 3, clientX: 2, clientY: 2, button: 0 });
    target.dispatch('pointermove', { pointerId: 3, clientX: 18, clientY: 2 });
    vi.advanceTimersByTime(2100); expect(open).not.toHaveBeenCalled();
    const event = { key: 'Enter', preventDefault: vi.fn() };
    target.dispatch('keydown', event); expect(event.preventDefault).toHaveBeenCalledOnce(); expect(open).toHaveBeenCalledOnce();
  });

  it('boots directly into the game and fits within dynamic mobile viewport and safe areas', () => {
    expect(appSource).toMatch(/startLevel\(1\)/);
    expect(appSource).not.toMatch(/title-logo|title-screen/);
    expect(appSource).toContain("import './style.css'");
  });

  it('defines the requested QA presets, diagnostics, candidate SHA, and level navigation', () => {
    expect(qaSource).toContain('[1, 1.5, 2, 2.5]');
    expect(qaSource).toContain('[0.12, 0.15, 0.18]');
    for (const label of ['Arrow IDs', 'Path ownership', 'Hit targets', 'Board geometry', 'Candidate', 'Reset QA settings']) expect(qaSource).toContain(label);
    expect(qaSource).toMatch(/\[1,2,3,4,5,6\]\.map/);
    expect(qaSource).toContain('data-level="${value}"');
    expect(qaSource).toContain('2000');
    expect(appSource).toMatch(/import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_QA_MODE === 'true'/);
    expect(appSource).toContain('5.5 * speedMultiplier');
  });

  it('does not persist temporary QA settings or game progress', () => {
    expect(appSource).not.toMatch(/localStorage|sessionStorage/);
    expect(qaSource).not.toMatch(/localStorage|sessionStorage/);
  });

  it('accepts the first tap immediately and suppresses rapid duplicate actions until cooldown ends', () => {
    const gate = createActionGate(220);
    expect(gate.accept(1000)).toBe(true);
    expect(gate.accept(1001)).toBe(false);
    expect(gate.accept(1219)).toBe(false);
    expect(gate.accept(1220)).toBe(true);
    gate.reset();
    expect(gate.accept(0)).toBe(true);
  });
});
