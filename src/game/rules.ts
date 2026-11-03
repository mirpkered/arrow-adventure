import type { Arrow, Level, MoveResult, Point } from './types';
import { arrowsCollide, segmentDistance, ARROW_STROKE_WIDTH } from './geometry';

export const pointKey = ({ x, y }: Point): string => `${x},${y}`;

export function exitDirection(arrow: Arrow): Point {
  const last = arrow.path.at(-1);
  const previous = arrow.path.at(-2);
  if (!last || !previous) throw new Error(`${arrow.id} needs a head and a preceding path cell`);
  return { x: last.x - previous.x, y: last.y - previous.y };
}

export function directionName(direction: Point): string {
  const names: Record<string, string> = {
    '1,0': 'east', '1,-1': 'northeast', '0,-1': 'north', '-1,-1': 'northwest',
    '-1,0': 'west', '-1,1': 'southwest', '0,1': 'south', '1,1': 'southeast',
  };
  const name = names[`${direction.x},${direction.y}`];
  if (name) return name;
  throw new Error(`Invalid exit direction (${direction.x}, ${direction.y})`);
}

function isOutside(point: Point, width: number, height: number): boolean {
  return point.x < 0 || point.x >= width || point.y < 0 || point.y >= height;
}

export function validateArrow(arrow: Arrow, width: number, height: number): void {
  if (arrow.path.length < 2) throw new Error(`${arrow.id} needs at least two cells`);
  const seen = new Set<string>();
  arrow.path.forEach((point, index) => {
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
      throw new Error(`${arrow.id} leaves the board at ${pointKey(point)}`);
    }
    const key = pointKey(point);
    if (seen.has(key)) throw new Error(`${arrow.id} crosses itself at ${key}`);
    seen.add(key);
    if (index > 0) {
      const previous = arrow.path[index - 1];
      const dx = Math.abs(previous.x - point.x);
      const dy = Math.abs(previous.y - point.y);
      if (Math.max(dx, dy) !== 1) throw new Error(`${arrow.id} has a disconnected path`);
    }
  });
  const pathSegments = arrow.path.slice(1).map((point, index) => ({ a: arrow.path[index], b: point }));
  for (let left = 0; left < pathSegments.length; left += 1) {
    for (let right = left + 2; right < pathSegments.length; right += 1) {
      if (segmentDistance(pathSegments[left], pathSegments[right]) <= ARROW_STROKE_WIDTH) {
        throw new Error(`${arrow.id} has a visually self-intersecting path`);
      }
    }
  }
}

export function validateLevel(level: Level): void {
  if (!Number.isInteger(level.width) || level.width < 1 || !Number.isInteger(level.height) || level.height < 1) throw new Error(`Level ${level.number} has invalid dimensions`);
  if (level.arrows.length === 0) throw new Error(`Level ${level.number} is empty`);
  const ids = new Set<string>();
  for (const [index, arrow] of level.arrows.entries()) {
    if (ids.has(arrow.id)) throw new Error(`Level ${level.number} has duplicate arrow ID ${arrow.id}`);
    ids.add(arrow.id);
    validateArrow(arrow, level.width, level.height);
    for (const other of level.arrows.slice(0, index)) if (arrowsCollide(arrow, other)) throw new Error(`${arrow.id} visually collides with ${other.id}`);
  }
}

/** Simulate every path-step advance. No state is changed unless the full exit succeeds. */
export function simulateMove(arrow: Arrow, others: Arrow[], width: number, height: number): MoveResult {
  let body = arrow.path.map((point) => ({ ...point }));
  const frames: Point[][] = [];
  let head = body.at(-1)!;
  const direction = exitDirection(arrow);
  if (Math.max(Math.abs(direction.x), Math.abs(direction.y)) !== 1 || (direction.x === 0 && direction.y === 0)) throw new Error(`${arrow.id} has an invalid exit direction`);

  // The body advances as a chain along its winding route. Check every occupied
  // cell in each new frame, so a future curved route cannot silently clip a blocker.
  while (body.length > 0) {
    head = body.at(-1)!;
    const nextHead = { x: head.x + direction.x, y: head.y + direction.y };
    const nextBody = [...body.slice(1), nextHead];
    const moving = { ...arrow, path: nextBody };
    const blocker = others.find((other) => arrowsCollide(moving, other));
    if (blocker) return { ok: false, blockedBy: blocker.id };
    body = nextBody;
    frames.push(body.map((point) => ({ ...point })));
    // Each frame follows the final facing direction until every segment is
    // beyond the board boundary, regardless of which edge it exits.
    if (body.every((point) => isOutside(point, width, height))) return { ok: true, frames };
  }
  return { ok: true, frames };
}

export function solveLevel(level: Level): string[] | null {
  const initial = level.arrows.map((arrow) => ({ ...arrow, path: arrow.path.map((p) => ({ ...p })) }));
  const memo = new Set<string>();
  const search = (remaining: Arrow[]): string[] | null => {
    if (remaining.length === 0) return [];
    const key = remaining.map((arrow) => arrow.id).sort().join('|');
    if (memo.has(key)) return null;
    memo.add(key);
    for (const arrow of remaining) {
      const move = simulateMove(arrow, remaining.filter((other) => other.id !== arrow.id), level.width, level.height);
      if (!move.ok) continue;
      const tail = search(remaining.filter((other) => other.id !== arrow.id));
      if (tail) return [arrow.id, ...tail];
    }
    return null;
  };
  return search(initial);
}

export function completeLevel(arrows: Arrow[]): boolean { return arrows.length === 0; }

export function movedPathIsOffBoard(frames: Point[][], width: number, height: number): boolean {
  const finalFrame = frames.at(-1) ?? [];
  return finalFrame.length === 0 || finalFrame.every((point) => isOutside(point, width, height));
}
