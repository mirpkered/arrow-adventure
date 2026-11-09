import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import appSource from '../src/main.ts?raw';
import qaSource from '../src/qa/qaPanel.ts?raw';
import { bindLongPress } from '../src/qa/qaPanel';
import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel, validateCuratedLevels } from '../src/game/catalog';
import { ARROW_COLLISION_WIDTH, ARROW_MAX_RENDERED_WIDTH, ARROW_STROKE_WIDTH, BOARD_GRID_SPACING, arrowHeadTriangle, arrowsCollide, findSelfBodyClearanceIssue, findSelfHeadClearanceIssue, isBoardGridIntersection, toBoardPoint } from '../src/game/geometry';
import { boardGridMarkup } from '../src/app/boardGrid';
import { measureBoardDensity } from '../src/game/density';
import { analyzeLevel, completeLevel, directionName, exitDirection, MOVE_SUBSTEPS, movedPathIsOffBoard, moveArrowDistance, nearestArrowAt, simulateMove, solveLevel, TOUCH_PICK_RADIUS, validateArrow, validateArrowSelfTraversal, validateLevel } from '../src/game/rules';
import { advanceSession, createRun, createSession, loseHeart } from '../src/game/session';
import { createActionGate } from '../src/game/input';
import { movementDuration, NORMAL_MOVE_SPEED, RETURN_MOVE_SPEED } from '../src/app/motion';
import { auditReachableStates, legalMoves } from '../src/game/stateAudit';
import type { Arrow, Level, Point } from '../src/game/types';

const styleSource = readFileSync(fileURLToPath(new URL('../src/style.css', import.meta.url)), 'utf8');
const titleSceneSource = readFileSync(fileURLToPath(new URL('../public/branding/arrow-adventure-title-scene.svg', import.meta.url)), 'utf8');

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
      expect(entry.puzzle.arrows.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps visual stroke presets separate from canonical collision and solver rules', () => {
    expect(ARROW_STROKE_WIDTH).toBe(0.12);
    expect(ARROW_COLLISION_WIDTH).toBe(0.18);
    for (const entry of CURATED_LEVELS) {
      expect(() => validateLevel(entry.puzzle)).not.toThrow();
      const canonicalSolution = solveLevel(entry.puzzle);
      expect(canonicalSolution, entry.id).not.toBeNull();
      const heading = entry.puzzle.arrows[0].path;
      const visibleHead = arrowHeadTriangle(heading);
      expect(visibleHead).toEqual(arrowHeadTriangle(heading, 0.15));
      expect(appSource).toContain('arrowHeadTriangle(arrow.path)');
      expect(solveLevel(entry.puzzle)).toEqual(canonicalSolution);
    }
  });

  it('freezes all six authored puzzle fingerprints for repeatable QA candidates', async () => {
    const fingerprints = await Promise.all(CURATED_LEVELS.map(async ({ puzzle }) => {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(puzzle)));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }));
    expect(fingerprints).toEqual([
      'f2eea1badfe8d925a93aa7d8cf38335494bdd4966afa2bd1680c989a57a32d3e',
      'ad6daeee824c5caf1f6daf6f52cd41d6613cd2d28f76415baece4558f6822058',
      '3a4b9275f6413976df1fcd5858934c6b195df4b991d7b1669f9a7737a3b1be2d',
      '3980a0aeb66e99ff2b4b0772112589b3b865d01c3f86fb12904de5dd72450b15',
      'bb8c27c5324732870afb48a48c9568a60af3df9b5c624fd0b3665162c38947ff',
      '0a86c43f5843b91b47f706155502f487819e3f173c118674ab5aa25e905c0d8e',
    ]);
  });

  it('ramps from forced openings toward multiple safe choices and deeper dependencies', () => {
    const openingCounts = CURATED_LEVELS.map(({ puzzle }) => puzzle.arrows.filter((arrow) =>
      simulateMove(arrow, puzzle.arrows.filter((other) => other.id !== arrow.id), puzzle.width, puzzle.height).ok,
    ).length);
    const metrics = CURATED_LEVELS.map(({ puzzle }) => analyzeLevel(puzzle));
    expect(openingCounts).toEqual(metrics.map(({ initiallyRemovable }) => initiallyRemovable));
    expect(metrics.map(({ interleavedPairs }) => interleavedPairs)).toEqual([7, 10, 6, 8, 6, 20]);
    expect(metrics.map(({ closeSegmentContacts }) => closeSegmentContacts)).toEqual([119, 222, 131, 218, 141, 354]);
    expect(metrics.map(({ dependencyDepth }) => dependencyDepth)).toEqual([5, 7, 2, 8, 3, 8]);
    expect(metrics.map(({ initiallyRemovable }) => initiallyRemovable)).toEqual([2, 4, 4, 2, 4, 5]);
    expect(metrics.every(({ occupancyRatio }) => occupancyRatio >= 0.25)).toBe(true);
    expect(metrics.every(({ blockingDependencies }) => blockingDependencies > 0)).toBe(true);
    expect(metrics.filter(({ newlyUnlockedByRemoval }) => newlyUnlockedByRemoval.some((count) => count > 0))).toHaveLength(5);
    expect(CURATED_LEVELS[5].puzzle.arrows.some(({ path }) => path.some((point, index) => index > 0
      && Math.abs(point.x - path[index - 1].x) === 1 && Math.abs(point.y - path[index - 1].y) === 1))).toBe(true);
  });

  it('exhaustively audits all reachable removal states for every authored level', () => {
    const reports = CURATED_LEVELS.map((entry) => ({ id: entry.id, ...auditReachableStates(entry.puzzle) }));
    expect(reports.every(({ exact, deadlocks, dependencyCycles, terminalStates }) => exact && deadlocks.length === 0 && dependencyCycles.length === 0 && terminalStates === 1)).toBe(true);
    expect(reports.map(({ reachableStates }) => reachableStates)).toEqual([16, 83, 54, 14, 38, 350]);
    expect(reports.map(({ legalTransitions }) => legalTransitions)).toEqual([24, 205, 135, 16, 83, 1159]);
  });

  it('runs individual self-geometry validation on every published arrow', () => {
    let audited = 0;
    for (const entry of CURATED_LEVELS) for (const arrow of entry.puzzle.arrows) {
      expect(() => validateArrow(arrow, entry.puzzle.width, entry.puzzle.height, entry.number), `${entry.number}/${arrow.id}`).not.toThrow();
      audited += 1;
    }
    expect(audited).toBe(60);
  });

  it('reproduces Level 3 with two long arrows and rejects its former self-colliding head route', () => {
    const entry = CURATED_LEVELS[2];
    const corrected = entry.puzzle.arrows.find(({ id }) => id === 'a03')!;
    let remaining = [...entry.puzzle.arrows];
    for (const id of ['a06', 'a07', 'a05', 'a02', 'a04']) {
      expect(legalMoves({ ...entry.puzzle, arrows: remaining }).some(({ arrow }) => arrow.id === id), `Level 3 can clear ${id}`).toBe(true);
      remaining = remaining.filter((arrow) => arrow.id !== id);
    }
    expect(remaining.map(({ id }) => id).sort()).toEqual(['a01', 'a03']);
    expect(legalMoves({ ...entry.puzzle, arrows: remaining }).map(({ arrow }) => arrow.id)).toEqual(['a03']);
    expect(simulateMove(corrected, remaining.filter(({ id }) => id !== corrected.id), entry.puzzle.width, entry.puzzle.height).ok).toBe(true);
    expect(() => validateArrowSelfTraversal(corrected, entry.puzzle.width, entry.puzzle.height, 3)).not.toThrow();

    const formerDirection = { ...corrected, path: [...corrected.path].reverse() };
    expect(() => validateArrow(formerDirection, entry.puzzle.width, entry.puzzle.height, 3)).toThrow(/Level 3 arrow a03: arrowhead self-collision.*segment/i);
    expect(() => simulateMove(formerDirection, [], entry.puzzle.width, entry.puzzle.height)).toThrow(/arrowhead self-collision/i);
    expect(() => solveLevel({ ...entry.puzzle, arrows: entry.puzzle.arrows.map((arrow) => arrow.id === 'a03' ? formerDirection : arrow) })).toThrow(/arrowhead self-collision/i);
    const collisionPose = moveArrowDistance(formerDirection, 0.5).map(({ x, y }) => ({ x: x - 0.5, y: y - 0.5 }));
    expect(findSelfHeadClearanceIssue(collisionPose, 0)).toMatchObject({ type: 'head-clearance', segmentAIndex: 4 });
  });

  it('keeps regression fixtures for the other three published self-colliding exits', () => {
    const level4 = CURATED_LEVELS[3].puzzle;
    const level4a04 = level4.arrows.find(({ id }) => id === 'a04')!;
    const oldA04 = { ...level4a04, path: [...level4a04.path.slice(0, 16), { x: 7, y: 9 }, { x: 8, y: 9 }] };
    expect(() => validateArrow(oldA04, level4.width, level4.height, 4)).toThrow(/Level 4 arrow a04: arrowhead self-collision/i);
    for (const [entry, id] of [[level4, 'a06'], [CURATED_LEVELS[5].puzzle, 'a10']] as const) {
      const safeOrientation = entry.arrows.find((arrow) => arrow.id === id)!;
      const unsafeOrientation = { ...safeOrientation, path: [...safeOrientation.path].reverse() };
      expect(() => validateArrow(unsafeOrientation, entry.width, entry.height, entry.number)).toThrow(new RegExp(`Level ${entry.number} arrow ${id}: arrowhead self-collision`, 'i'));
    }
  });

  it('reproduces the reported Level 4 seven-arrow state and verifies its remaining route', () => {
    const entry = CURATED_LEVELS[3];
    const sequences: string[][] = [];
    const walk = (remaining: typeof entry.puzzle.arrows, sequence: string[]) => {
      if (sequence.length === 3) {
        sequences.push(sequence);
        return;
      }
      for (const arrow of legalMoves({ ...entry.puzzle, arrows: remaining })) {
        walk(remaining.filter(({ id }) => id !== arrow.arrow.id), [...sequence, arrow.arrow.id]);
      }
    };
    walk(entry.puzzle.arrows, []);
    expect(sequences).toEqual([['a05', 'a07', 'a08'], ['a07', 'a05', 'a08']]);
    const remainingIds = ['a01', 'a02', 'a03', 'a04', 'a06', 'a09', 'a10'];
    const remaining = remainingIds.map((id) => entry.puzzle.arrows.find((arrow) => arrow.id === id)!);
    expect(entry.puzzle.arrows).toHaveLength(10);
    expect(legalMoves({ ...entry.puzzle, arrows: remaining }).map(({ arrow }) => arrow.id)).toEqual(['a06']);
    expect(simulateMove(remaining.find(({ id }) => id === 'a06')!, remaining.filter(({ id }) => id !== 'a06'), entry.puzzle.width, entry.puzzle.height).ok).toBe(true);
    for (const blocked of remaining.filter(({ id }) => id !== 'a06')) {
      expect(simulateMove(blocked, remaining.filter(({ id }) => id !== blocked.id), entry.puzzle.width, entry.puzzle.height).ok).toBe(false);
    }
    const report = auditReachableStates({ ...entry.puzzle, arrows: remaining });
    expect(report).toMatchObject({ exact: true, reachableStates: 10, legalTransitions: 11, terminalStates: 1, initialLegalMoves: ['a06'], deadlocks: [], dependencyCycles: [] });
    const solution = solveLevel({ ...entry.puzzle, arrows: remaining });
    expect(solution).toEqual(['a06', 'a10', 'a01', 'a04', 'a03', 'a09', 'a02']);
    let current = remaining;
    for (const id of solution!) {
      const arrow = current.find((candidate) => candidate.id === id)!;
      expect(simulateMove(arrow, current.filter((candidate) => candidate.id !== id), entry.puzzle.width, entry.puzzle.height).ok).toBe(true);
      current = current.filter((candidate) => candidate.id !== id);
    }
    expect(current).toHaveLength(0);
    expect(loseHeart(loseHeart(3))).toBe(1);
  });

  it('reports an exact deadlock witness and dependency cycle for a mutually blocked board', () => {
    const level: Level = {
      number: 99, width: 8, height: 7,
      arrows: [makeArrow('east', [{ x: 1, y: 4 }, { x: 2, y: 4 }]), makeArrow('west', [{ x: 6, y: 4 }, { x: 5, y: 4 }])],
    };
    const result = auditReachableStates(level);
    expect(result.reachableStates).toBe(1);
    expect(result.initialLegalMoves).toEqual([]);
    expect(result.deadlocks).toEqual([{ remainingArrowIds: ['east', 'west'], removalSequence: [] }]);
    expect(result.dependencyCycles).toHaveLength(1);
    expect(result.dependencyCycles[0]).toEqual(expect.arrayContaining(['east', 'west']));
    expect(solveLevel(level)).toBeNull();
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
    const refined = measureBoardDensity(CURATED_LEVELS[4].puzzle);
    expect(refined.sampleStep).toBe(0.25);
    expect(refined.areaFartherThan).toBe(1.5);
    expect(refined.pathLength).toBe(97);
    expect(refined.occupancyRatio).toBeCloseTo(0.5774, 3);
    expect(refined.largeGapRatio).toBeCloseTo(0.1875, 4);
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
    const arrowA = level.arrows[0];
    const remaining = level.arrows.slice(1);
    const result = simulateMove(arrowA, remaining, level.width, level.height);
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
    expect(qaSource).toMatch(/\[1,2,3,4,5,6\]\.map/);
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
    expect(appSource).toContain('if (!storage || busy || (QA_MODE && temporaryQARun)) return');
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
