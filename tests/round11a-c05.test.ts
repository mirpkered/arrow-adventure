import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS } from '../src/game/catalog';
import {
  ARROW_MAX_RENDERED_WIDTH,
  arrowHeadTriangle,
  findSelfBodyClearanceIssue,
  findSelfHeadClearanceIssue,
} from '../src/game/geometry';
import {
  completeLevel,
  exitDirection,
  moveArrowDistance,
  simulateMove,
  solveLevel,
  validateArrow,
  validateLevel,
} from '../src/game/rules';
import { auditReachableStates } from '../src/game/stateAudit';
import type { Arrow, Point } from '../src/game/types';

const level = CURATED_LEVELS[2].puzzle;
const c05 = level.arrows.find(({ id }) => id === 'c05')!;
const reportedRoute: Point[] = [
  { x: 7, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 3 },
  { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 3 },
];

function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - a.x - ratio * dx, point.y - a.y - ratio * dy);
}

function pointInTriangle(point: Point, triangle: Point[]): boolean {
  const cross = (a: Point, b: Point) => (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
  const signs = [cross(triangle[0], triangle[1]), cross(triangle[1], triangle[2]), cross(triangle[2], triangle[0])];
  return signs.every((value) => value >= 0) || signs.every((value) => value <= 0);
}

function pointToTriangleDistance(point: Point, triangle: Point[]): number {
  if (pointInTriangle(point, triangle)) return 0;
  return Math.min(
    pointSegmentDistance(point, triangle[0], triangle[1]),
    pointSegmentDistance(point, triangle[1], triangle[2]),
    pointSegmentDistance(point, triangle[2], triangle[0]),
  );
}

function minimumHeadTailSurfaceClearance(arrow: Arrow, travelDistance: number): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let travel = 0; travel <= travelDistance + 1e-8; travel += 0.005) {
    const frame = moveArrowDistance(arrow, Math.min(travel, travelDistance), level.grid!.pathOffset);
    const triangle = arrowHeadTriangle(frame, ARROW_MAX_RENDERED_WIDTH, level.grid!.pathOffset);
    // Visible tail radius .09 plus its .025 outline; head outline is .025.
    const surfaceGap = pointToTriangleDistance(frame[0], triangle) - 0.1025 - 0.0125;
    minimum = Math.min(minimum, surfaceGap);
  }
  return minimum;
}

describe('Round 11A Level 3 c05 tail-approach correction', () => {
  it('records the reported route and proves the former close approach was visual rather than a swept body collision', () => {
    const oldArrow: Arrow = { id: 'c05-before', path: reportedRoute };
    expect(oldArrow.path).toEqual([
      { x: 7, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 3 },
      { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 3 },
    ]);
    validateArrow(oldArrow, level.width, level.height, level.number, level.grid);
    const initialBlock = simulateMove(oldArrow, level.arrows.filter(({ id }) => id !== 'c05'), level.width, level.height, level.grid);
    expect(initialBlock).toMatchObject({ ok: false, blockedBy: 'c09' });
    const afterBlockerRemoval = simulateMove(oldArrow, level.arrows.filter(({ id }) => id !== 'c05' && id !== 'c09'), level.width, level.height, level.grid);
    expect(afterBlockerRemoval.ok).toBe(true);
    const fullTravel = simulateMove(oldArrow, [], level.width, level.height, level.grid);
    expect(fullTravel.ok).toBe(true);
    const nearTailFrame = moveArrowDistance(oldArrow, 0.5, level.grid!.pathOffset);
    expect(nearTailFrame.at(-1)!.y).toBeGreaterThan(3);
    expect(nearTailFrame.at(-1)!.y).toBeLessThan(4);
    expect(nearTailFrame[0].x).toBeLessThan(7);
    expect(moveArrowDistance(oldArrow, 1, level.grid!.pathOffset).at(-1)).toEqual({ x: 7, y: 4 });
    for (let travel = 0; travel <= fullTravel.travelDistance + 1e-8; travel += 0.05) {
      const frame = moveArrowDistance(oldArrow, Math.min(travel, fullTravel.travelDistance), level.grid!.pathOffset);
      expect(findSelfBodyClearanceIssue(frame, 0.05, level.grid!.pathOffset)).toBeUndefined();
      expect(findSelfHeadClearanceIssue(frame, 0.05, level.grid!.pathOffset)).toBeUndefined();
    }
    const oldSurfaceGap = minimumHeadTailSurfaceClearance(oldArrow, fullTravel.travelDistance);
    expect(oldSurfaceGap).toBeGreaterThan(0);
    expect(oldSurfaceGap).toBeLessThan(0.35);
  });

  it('keeps c05 on the exact same corridor but sends its head away from the original tail', () => {
    expect(c05.path).toEqual([...reportedRoute].reverse());
    expect(exitDirection(c05)).toEqual({ x: 1, y: 0 });
    expect(CURATED_LEVELS[2].contentVersion).toBe(3);
    expect(() => validateArrow(c05, level.width, level.height, level.number, level.grid)).not.toThrow();
    expect(() => validateLevel(level)).not.toThrow();

    const alone = simulateMove(c05, [], level.width, level.height, level.grid);
    expect(alone.ok).toBe(true);
    expect(minimumHeadTailSurfaceClearance(c05, alone.travelDistance)).toBeGreaterThan(0.65);
    expect(moveArrowDistance(c05, 1.1, level.grid!.pathOffset)).toHaveLength(c05.path.length - 1);

    const previousVersion = { ...c05, path: [...reportedRoute] };
    let previousTail: Point | undefined;
    for (let travel = 0; travel <= alone.travelDistance + 1e-8; travel += 0.05) {
      const frame = moveArrowDistance(c05, Math.min(travel, alone.travelDistance), level.grid!.pathOffset);
      expect(findSelfBodyClearanceIssue(frame, 0.05, level.grid!.pathOffset)).toBeUndefined();
      expect(findSelfHeadClearanceIssue(frame, 0.05, level.grid!.pathOffset)).toBeUndefined();
      if (previousTail && travel < 1) expect(frame[0].y).toBeLessThan(previousTail.y);
      previousTail = frame[0];
    }

    const otherArrows = level.arrows.filter(({ id }) => id !== 'c05');
    expect(simulateMove(c05, otherArrows, level.width, level.height, level.grid).ok).toBe(true);
    expect(previousVersion.path).toEqual(reportedRoute);
  });

  it('finishes Level 3 under the shared movement simulator with no deadlocks or dependency cycles', () => {
    const audit = auditReachableStates(level);
    expect(audit).toMatchObject({ exact: true, reachableStates: 84, legalTransitions: 212, terminalStates: 1, deadlocks: [], dependencyCycles: [] });
    expect(audit.initialLegalMoves).toHaveLength(4);

    let remaining = [...level.arrows];
    for (const id of solveLevel(level)!) {
      const moving = remaining.find(({ id: candidate }) => candidate === id)!;
      expect(simulateMove(moving, remaining.filter(({ id: candidate }) => candidate !== id), level.width, level.height, level.grid).ok).toBe(true);
      remaining = remaining.filter(({ id: candidate }) => candidate !== id);
    }
    expect(completeLevel(remaining)).toBe(true);
  });
});
