import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import appSource from '../src/main.ts?raw';
import qaSource from '../src/qa/qaPanel.ts?raw';
import { bindLongPress } from '../src/qa/qaPanel';
import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel, validateCuratedLevels } from '../src/game/catalog';
import { ARROW_COLLISION_WIDTH, ARROW_MAX_RENDERED_WIDTH, ARROW_STROKE_WIDTH, BOARD_GRID_SPACING, arrowHeadTriangle, arrowsCollide, findSelfBodyClearanceIssue, isBoardGridIntersection, toBoardPoint } from '../src/game/geometry';
import { boardGridMarkup } from '../src/app/boardGrid';
import { measureBoardDensity, measureComposition } from '../src/game/density';
import { completeLevel, directionName, exitDirection, MOVE_SUBSTEPS, movedPathIsOffBoard, moveArrowDistance, nearestArrowAt, simulateMove, solveLevel, TOUCH_PICK_RADIUS, validateArrow, validateLevel } from '../src/game/rules';
import { advanceSession, createRun, createSession, loseHeart } from '../src/game/session';
import { createActionGate } from '../src/game/input';
import { movementDuration, NORMAL_MOVE_SPEED, RETURN_MOVE_SPEED } from '../src/app/motion';
import { auditReachableStates } from '../src/game/stateAudit';
import type { Arrow, Level, Point } from '../src/game/types';
import { ARCHIVED_ROUND8_LEVELS } from '../src/game/archive/catalog-round8';
import archivedRound9 from '../src/game/archive/adventure-catalog-first-flight-r1.json';

const styleSource = readFileSync(fileURLToPath(new URL('../src/style.css', import.meta.url)), 'utf8');
const titleSceneSource = readFileSync(fileURLToPath(new URL('../public/branding/arrow-adventure-title-scene.svg', import.meta.url)), 'utf8');
const makeArrow = (id: string, path: Point[]): Arrow => ({ id, path });

describe('Round 11 curated catalog', () => {
  it('contains five stable, ordered true-grid levels with deliberate progression metadata', () => {
    expect(CURATED_LEVELS).toHaveLength(5);
    expect(CURATED_LEVELS.map(({number}) => number)).toEqual([1, 2, 3, 4, 5]);
    expect(CURATED_LEVELS.map(({id}) => id)).toEqual(Array.from({length:5}, (_, index) => `first-flight-${String(index + 1).padStart(3, '0')}`));
    expect(CURATED_LEVELS.map(({title}) => title)).toEqual(['First Steps', 'Close Quarters', 'Winding Paths', 'The Weave', 'First Challenge']);
    expect(CURATED_LEVELS.map(({difficulty}) => difficulty)).toEqual(['intro', 'easy', 'easy-medium', 'medium', 'medium-hard']);
    expect(CURATED_LEVELS.every(({composition}) => composition === 'abstract')).toBe(true);
    for (const entry of CURATED_LEVELS) {
      expect(entry.catalogVersion).toBe('first-flight-r3-compact-weave');
      expect(entry.contentVersion).toBe(2);
      expect(entry.puzzle.grid).toEqual({ spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true });
      expect(entry.puzzle.width).toBeGreaterThan(0);
      expect(entry.puzzle.height).toBeGreaterThan(0);
      for (const arrow of entry.puzzle.arrows) for (let index = 0; index < arrow.path.length; index++) {
        const point = arrow.path[index];
        expect(Number.isInteger(point.x) && Number.isInteger(point.y), `${entry.id}/${arrow.id} visible-grid vertex`).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(entry.puzzle.width);
        expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(entry.puzzle.height);
        if (index > 0) {
          const previous = arrow.path[index - 1];
          const dx = Math.abs(point.x - previous.x), dy = Math.abs(point.y - previous.y);
          expect(Math.max(dx, dy)).toBe(1);
          expect(dx === 0 || dy === 0 || dx === dy).toBe(true);
        }
      }
    }
    expect(getCuratedLevel(1)?.id).toBe('first-flight-001');
    expect(getNextCuratedLevel(CURATED_LEVELS[0])?.number).toBe(2);
    expect(getNextCuratedLevel(CURATED_LEVELS.at(-1)!)).toBeUndefined();
    expect(() => validateCuratedLevels()).not.toThrow();
  });
  it('checks geometry, solver/runtime agreement, and every exact reachable-state audit', () => {
    let auditedArrows = 0;
    for (const entry of CURATED_LEVELS) {
      expect(entry.catalogVersion).toBe('first-flight-r3-compact-weave');
      expect(entry.contentVersion).toBe(2);
      expect(() => validateLevel(entry.puzzle), entry.id).not.toThrow();
      const solution = solveLevel(entry.puzzle);
      expect(solution, entry.id).not.toBeNull();
      let remaining = [...entry.puzzle.arrows];
      for (const id of solution!) {
        const arrow = remaining.find(({id: candidate}) => candidate === id)!;
        expect(simulateMove(arrow, remaining.filter(({id: candidate}) => candidate !== id), entry.puzzle.width, entry.puzzle.height, entry.puzzle.grid).ok).toBe(true);
        remaining = remaining.filter(({id: candidate}) => candidate !== id);
      }
      expect(remaining).toHaveLength(0);
      const report = auditReachableStates(entry.puzzle);
      expect(report.exact).toBe(true);
      expect(report.deadlocks, entry.id).toEqual([]);
      expect(report.dependencyCycles, entry.id).toEqual([]);
      expect(report.terminalStates).toBe(1);
      for (const arrow of entry.puzzle.arrows) {
        expect(() => validateArrow(arrow, entry.puzzle.width, entry.puzzle.height, entry.number, entry.puzzle.grid), `${entry.number}/${arrow.id}`).not.toThrow();
        auditedArrows += 1;
      }
    }
    expect(auditedArrows).toBe(CURATED_LEVELS.reduce((sum, entry) => sum + entry.puzzle.arrows.length, 0));
  });
  it('keeps visual stroke width separate from collision legality', () => {
    expect(ARROW_STROKE_WIDTH).toBe(0.12);
    expect(ARROW_COLLISION_WIDTH).toBe(0.18);
    for (const entry of CURATED_LEVELS) {
      const solution = solveLevel(entry.puzzle);
      const path = entry.puzzle.arrows[0].path;
      expect(arrowHeadTriangle(path)).toEqual(arrowHeadTriangle(path, 0.15));
      expect(appSource).toContain('arrowHeadTriangle(arrow.path)');
      expect(solveLevel(entry.puzzle)).toEqual(solution);
    }
  });
  it('retains the previous ten-level provisional catalog and six-level release archive outside active play', () => {
    expect(archivedRound9.catalogVersion).toBe('first-flight-r1');
    expect(archivedRound9.levels).toHaveLength(10);
    expect(archivedRound9.levels.map(({id}) => id)).toEqual(Array.from({length:10}, (_, index) => `first-flight-${String(index + 1).padStart(3, '0')}`));
    expect(ARCHIVED_ROUND8_LEVELS.map(({puzzle}) => puzzle.arrows.length)).toEqual([7,12,7,10,8,16]);
    expect(CURATED_LEVELS.some(({id}) => id.startsWith('shared-board-'))).toBe(false);
  });
  it('freezes the five deterministic puzzle definitions', async () => {
    const fingerprints = await Promise.all(CURATED_LEVELS.map(async ({puzzle}) => {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(puzzle)));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }));
    expect(fingerprints).toEqual([
      '37cbe680ff4584bb62ce00e0b339cccfcba84b684e2067e9c785f9cc3f2d9faa',
      '9d1363d47f6ab4fe8f3ac389037123f94491934739fe5c23af31bbcad6b0515e',
      '508038279aa37369989999aa52fcfc4708677541af6ae9fa6c293c32f24d0583',
      '80ecd915ed11398c641c227aa20ccab6a72d633a3cfa0d6cc45af5fda796a66d',
      '0889f74c4ebe063b8d864607e518ea6141fd3ca6227c32cb494e1b8f61e87381',
    ]);
  });
  it('rejects duplicate IDs, numbering gaps and mismatched puzzle metadata', () => {
    const duplicateId = CURATED_LEVELS.map((entry, index) => index === 1 ? { ...entry, id: CURATED_LEVELS[0].id } : entry);
    const numberingGap = CURATED_LEVELS.map((entry, index) => index === 1 ? { ...entry, number: 11, puzzle: { ...entry.puzzle, number: 11 } } : entry);
    const mismatchedPuzzle = CURATED_LEVELS.map((entry, index) => index === 0 ? { ...entry, puzzle: { ...entry.puzzle, number: 2 } } : entry);
    expect(() => validateCuratedLevels(duplicateId)).toThrow(/duplicate level ID/i);
    expect(() => validateCuratedLevels(numberingGap)).toThrow(/contiguously/i);
    expect(() => validateCuratedLevels(mismatchedPuzzle)).toThrow(/does not match/i);
  });
});
describe('shared arrow geometry and movement', () => {
  it('accepts straight, tightly turning, and nested winding arrows with safe self-traversal', () => {
    const straight = makeArrow('straight', [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
    const tight = makeArrow('tight', [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }]);
    const nested = makeArrow('nested', [
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 },
      { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 5 },
      { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
    ]);
    for (const arrow of [straight, tight, nested]) {
      expect(() => validateArrow(arrow, 8, 8, 99), arrow.id).not.toThrow();
      expect(() => simulateMove(arrow, [], 8, 8), arrow.id).not.toThrow();
    }
  });

  it('rejects centerline crossings, repeated segments, self-touch, and sub-clearance parallels with diagnostics', () => {
    const crossing = makeArrow('crossing', [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 1 }]);
    const overlap = makeArrow('overlap', [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 1 }]);
    expect(() => validateArrow(crossing, 5, 5, 99)).toThrow(/Level 99 arrow crossing: self-intersection.*segments 0 and 2/i);
    expect(() => validateArrow(overlap, 5, 5, 99)).toThrow(/Level 99 arrow overlap: path crosses itself/i);

    const justInside = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: ARROW_COLLISION_WIDTH - 0.000001 }, { x: 0, y: ARROW_COLLISION_WIDTH - 0.000001 }];
    const atLimit = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: ARROW_COLLISION_WIDTH }, { x: 0, y: ARROW_COLLISION_WIDTH }];
    const justOutside = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: ARROW_COLLISION_WIDTH + 0.000001 }, { x: 0, y: ARROW_COLLISION_WIDTH + 0.000001 }];
    expect(findSelfBodyClearanceIssue(justInside)?.clearance).toBeCloseTo(ARROW_COLLISION_WIDTH - 0.000001);
    expect(findSelfBodyClearanceIssue(atLimit)?.clearance).toBeCloseTo(ARROW_COLLISION_WIDTH);
    expect(findSelfBodyClearanceIssue(justOutside)).toBeUndefined();
  });

  it('keeps close legal parallel arrows clear at both thin and widest visual stroke presets', () => {
    const closeA = makeArrow('close-a', [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
    const closeB = makeArrow('close-b', [{ x: 1, y: 1.5 }, { x: 2, y: 1.5 }, { x: 3, y: 1.5 }]);
    expect(ARROW_MAX_RENDERED_WIDTH).toBe(0.18);
    expect(() => validateLevel({ number: 99, width: 6, height: 5, arrows: [closeA, closeB] })).not.toThrow();
    expect(arrowsCollide(closeA, closeB)).toBe(false);
    expect(() => validateArrow(closeA, 6, 5, 99)).not.toThrow();
    expect(arrowHeadTriangle(closeA.path)).toHaveLength(3);
  });

  it('accepts cardinal and diagonal adjacent path segments and rejects malformed steps', () => {
    expect(() => validateArrow(makeArrow('winding', [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }]), 5, 5)).not.toThrow();
    expect(() => validateArrow(makeArrow('gap', [{ x: 0, y: 0 }, { x: 2, y: 0 }]), 5, 5)).toThrow(/invalid length/i);
    expect(() => validateArrow(makeArrow('repeat', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]), 5, 5)).toThrow(/crosses itself/i);
    expect(() => validateArrow(makeArrow('offset', [{ x: 0.5, y: 1 }, { x: 1.5, y: 1 }, { x: 1.5, y: 2 }]), 5, 5)).not.toThrow();
    expect(() => validateArrow(makeArrow('quarter', [{ x: 1.25, y: 1 }, { x: 2.25, y: 1 }]), 5, 5)).toThrow(/0\.5-unit board grid/i);
    expect(() => validateArrow(makeArrow('slope', [{ x: 0, y: 0 }, { x: 1, y: 0.5 }]), 5, 5)).toThrow(/45° diagonal/i);
    for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) {
      expect(() => validateArrow(makeArrow(`heading-${dx}-${dy}`, [{ x: 2, y: 2 }, { x: 2 + dx, y: 2 + dy }]), 5, 5)).not.toThrow();
    }
  });

  it('renders the visible grid and validates every route vertex on its exact half-unit lattice', () => {
    expect(BOARD_GRID_SPACING).toBe(0.5);
    expect(boardGridMarkup(2, 2)).toContain('M 0.5 0 V 2');
    expect(boardGridMarkup(2, 2)).toContain('M 0 0.5 H 2');
    expect(boardGridMarkup(2, 2)).toContain('class="grid-major "');
    for (const entry of CURATED_LEVELS) for (const arrow of entry.puzzle.arrows) {
      for (const point of arrow.path) expect(isBoardGridIntersection(toBoardPoint(point)), `${entry.number}/${arrow.id} @ ${point.x},${point.y}`).toBe(true);
    }
    expect(styleSource).toContain('.grid-fine,.grid-major');
    expect(styleSource).toContain('stroke-width:.025');
    expect(appSource).toContain('boardGridMarkup(level.width, level.height');
  });

  it('measures large board gaps by sampling the actual path field', () => {
    const refined = measureBoardDensity(ARCHIVED_ROUND8_LEVELS[4].puzzle);
    expect(refined.sampleStep).toBe(0.25);
    expect(refined.areaFartherThan).toBe(1.5);
    expect(refined.pathLength).toBe(97);
    expect(refined.occupancyRatio).toBeCloseTo(0.5774, 3);
    expect(refined.largeGapRatio).toBeCloseTo(0.1875, 4);
  });

  it('measures grid-adjacent packing, parallel corridors, route variety and direction', () => {
    const packed: Level = { number: 99, width: 8, height: 5, arrows: [
      makeArrow('upper', [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]),
      makeArrow('lower', [{ x: 1, y: 1.5 }, { x: 2, y: 1.5 }, { x: 3, y: 1.5 }, { x: 4, y: 1.5 }]),
    ] };
    const metrics = measureComposition(packed);
    expect(metrics.totalPathLength).toBe(6);
    expect(metrics.adjacentGridPathRatio).toBe(1);
    expect(metrics.parallelCorridorLength).toBe(3);
    expect(metrics.routeLengthBands).toEqual({ short: 2, medium: 0, long: 0 });
    expect(metrics.exitDirections).toEqual({ east: 2 });
    expect(metrics.touchCompetitionPathRatio).toBe(1);
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

  it('uses board pointer input and continuous requestAnimationFrame movement', () => {
    expect(appSource).toMatch(/addEventListener\('pointerdown'/);
    expect(appSource).toMatch(/requestAnimationFrame\(tick\)/);
    expect(appSource).not.toMatch(/setTimeout\(resolve,\s*16\)/);
    expect(appSource).toMatch(/let animationToken = 0/);
    expect(appSource).toMatch(/animationToken \+= 1/);
    expect(appSource).toMatch(/token !== animationToken/);
    expect(appSource).toMatch(/if \(busy \|\| screen !== 'game'\) return/);
    expect(appSource.match(/hearts = loseHeart\(hearts\)/g)).toHaveLength(1);
    expect(appSource).toContain('actionGate.accept(performance.now())');
    expect(appSource).toContain("addEventListener('pointerdown'");
    expect(appSource).toMatch(/if \(action === 'restart' && \(screen === 'game'/);
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
    const arrowA = level.arrows.find((arrow) => !simulateMove(arrow, level.arrows.filter(({id}) => id !== arrow.id), level.width, level.height, level.grid).ok)!;
    const remaining = level.arrows.filter(({id}) => id !== arrowA.id);
    const result = simulateMove(arrowA, remaining, level.width, level.height, level.grid);
    expect(result.ok).toBe(false);
  });

  it('animates a blocked arrow to impact, marks it red, reverses faster, and clears the mark only on removal', () => {
    expect(appSource).toMatch(/hearts = loseHeart\(hearts\)[\s\S]*?animateDistance\(arrow, group, 0, result\.travelDistance/);
    expect(appSource).toContain("group.classList.add('is-red', 'at-impact')");
    expect(appSource).toMatch(/animateDistance\(returning, group, result\.travelDistance, 0, RETURN_MOVE_SPEED/);
    expect(appSource).toContain('redArrowIds.add(id)');
    expect(appSource).toContain('redArrowIds.delete(id)');
    expect(appSource).toContain("redArrowIds.has(arrow.id) ? 'is-red' : ''");
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
        const result = simulateMove(arrow, remaining.filter((candidate) => candidate.id !== id), entry.puzzle.width, entry.puzzle.height, entry.puzzle.grid);
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

  it('uses only the new save key and ignores old prototype progress keys', () => {
    expect(appSource).not.toMatch(/mirpworks\.arrow-adventure\.save|save\.v1|save\.v2|loadProgress|saveProgress|migrateLegacyProgress/i);
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

  it('shows the Mirpworks splash and title menu before gameplay in a viewport-fitted shell', () => {
    expect(appSource).toContain('showLaunchSplash(document, window');
    expect(appSource).toContain("let screen: Screen = 'title'");
    expect(appSource).toContain('title-landscape');
    expect(titleSceneSource).toContain('viewBox="0 0 1170 2532"');
    expect(titleSceneSource).toContain('linearGradient id="trail"');
    expect(appSource).toContain('function startNewGame()');
    expect(styleSource).toContain('100dvh');
    expect(appSource).toContain("import './style.css'");
  });

  it('presents a portrait landscape title scene while keeping the square app icon for other branding only', () => {
    const titleTemplate = appSource.slice(appSource.indexOf('function renderTitle()'), appSource.indexOf('function renderSettings()'));
    for (const label of ['title-overline', 'title-wordmark', 'title-landscape', 'title-play', 'title-secondary', 'Settings', 'Credits', 'title-signature']) expect(titleTemplate).toContain(label);
    expect(titleTemplate).toContain('data-action="play"');
    expect(titleTemplate).toContain('data-action="continue"');
    expect(titleTemplate).toContain('data-action="settings"');
    expect(titleTemplate).toContain('data-action="credits"');
    expect(titleTemplate).not.toContain('gameLogo');
    expect(titleTemplate).not.toContain('title-art');
    expect(titleSceneSource).toContain('#17183F');
    expect(titleSceneSource).toContain('#FFD992');
    expect(titleSceneSource).toContain('#36DDE9');
    expect(styleSource).toContain('env(safe-area-inset-top');
    expect(styleSource).toContain('env(safe-area-inset-bottom');
    expect(styleSource).toContain('@media(orientation:landscape) and (min-width:700px)');
    expect(styleSource).toContain('@media(max-height:700px) and (orientation:portrait)');
    expect(styleSource).toContain('overflow:hidden');
    expect(appSource).toMatch(/if \(action === 'play'\) startNewGame\(\)/);
    expect(appSource).toMatch(/if \(action === 'continue'\) continueGame\(\)/);
    expect(appSource).toMatch(/if \(action === 'settings'\) openSettings\(\)/);
    expect(appSource).toMatch(/if \(action === 'credits'\).*screen = 'credits'/);
    expect(styleSource).toContain('--accent:#3857a4');
    expect(styleSource).toContain('.title-secondary-actions');
    expect(styleSource).toContain(':root[data-theme="dark"]');
    expect(appSource).toMatch(/if \(element\.dataset\.appearance\) \{[\s\S]*?saveSettingsNow\(\); render\(\); return;/);
  });

  it('defines the requested QA presets, diagnostics, candidate SHA, and level navigation', () => {
    expect(qaSource).toContain('[1, 1.5, 2, 2.5]');
    expect(qaSource).toContain('[0.12, 0.15, 0.18]');
    for (const label of ['Arrow IDs', 'Path ownership', 'Hit targets', 'Board geometry', 'Candidate', 'Reset QA state', 'Remaining IDs', 'Solver route', 'Collision check', 'Highlight one legal arrow', 'No legal moves']) expect(qaSource).toContain(label);
    expect(qaSource).toContain('Array.from({ length: options.levelCount }, (_, index) => index + 1)');
    expect(qaSource).toContain('data-level="${value}"');
    expect(qaSource).toContain('2000');
    expect(appSource).toMatch(/import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_QA_MODE === 'true'/);
    expect(appSource).toContain('speedMultiplier = 2');
    expect(NORMAL_MOVE_SPEED).toBe(21);
    expect(RETURN_MOVE_SPEED).toBeGreaterThan(NORMAL_MOVE_SPEED);
    expect(movementDuration(42, NORMAL_MOVE_SPEED)).toBe(1500);
    expect(movementDuration(42, NORMAL_MOVE_SPEED, true)).toBeLessThanOrEqual(140);
    expect(appSource).toContain('if (completeLevel(arrows))');
    expect(appSource).toContain('onLevel: (number) => startLevel(number, true)');
    expect(appSource).toContain("if (!storage || !shouldPersistProgress(activePrototype ? 'prototype-review' : 'adventure', busy) || (QA_MODE && temporaryQARun)) return");
  });

  it('persists player appearance, audio, and stable progress but not QA settings', () => {
    expect(appSource).toContain('window.localStorage');
    expect(appSource).toContain('saveGame(storage, next, storageKeys)');
    expect(appSource).toContain('saveSettings(storage, settings, storageKeys)');
    expect(appSource).toContain('Animation frames are never persisted');
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
