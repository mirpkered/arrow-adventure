import type { Arrow, Level, MoveResult, Point } from './types';

export const pointKey = ({ x, y }: Point): string => `${x},${y}`;

export function exitDirection(arrow: Arrow): Point {
  const last = arrow.path.at(-1);
  const previous = arrow.path.at(-2);
  if (!last || !previous) throw new Error(`${arrow.id} needs a head and a preceding path cell`);
  return { x: last.x - previous.x, y: last.y - previous.y };
}

export function directionName(direction: Point): string {
  if (direction.x === 1) return 'right';
  if (direction.x === -1) return 'left';
  if (direction.y === 1) return 'down';
  if (direction.y === -1) return 'up';
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
      if (Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) !== 1) throw new Error(`${arrow.id} has a disconnected path`);
    }
  });
  const last = arrow.path.at(-1)!;
  const previous = arrow.path.at(-2)!;
  const direction = { x: last.x - previous.x, y: last.y - previous.y };
  if (Math.abs(direction.x) + Math.abs(direction.y) !== 1) throw new Error(`${arrow.id} must face along a cardinal direction at its arrowhead`);
}

export function validateLevel(level: Level): void {
  if (!Number.isInteger(level.width) || level.width < 1 || !Number.isInteger(level.height) || level.height < 1) throw new Error(`Level ${level.number} has invalid dimensions`);
  if (level.arrows.length === 0) throw new Error(`Level ${level.number} is empty`);
  const occupied = new Map<string, string>();
  const ids = new Set<string>();
  for (const arrow of level.arrows) {
    if (ids.has(arrow.id)) throw new Error(`Level ${level.number} has duplicate arrow ID ${arrow.id}`);
    ids.add(arrow.id);
    validateArrow(arrow, level.width, level.height);
    for (const point of arrow.path) {
      const key = pointKey(point);
      const owner = occupied.get(key);
      if (owner) throw new Error(`${arrow.id} overlaps ${owner} at ${key}`);
      occupied.set(key, arrow.id);
    }
  }
}

/** Simulate every one-cell advance. No state is changed unless the full exit succeeds. */
export function simulateMove(arrow: Arrow, others: Arrow[], width: number, height: number): MoveResult {
  const stationary = new Map<string, string>();
  for (const other of others) for (const point of other.path) stationary.set(pointKey(point), other.id);

  let body = arrow.path.map((point) => ({ ...point }));
  const frames: Point[][] = [];
  let head = body.at(-1)!;
  const direction = exitDirection(arrow);
  if (Math.abs(direction.x) + Math.abs(direction.y) !== 1) throw new Error(`${arrow.id} has an invalid exit direction`);

  // The body advances as a chain along its winding route. Check every occupied
  // cell in each new frame, so a future curved route cannot silently clip a blocker.
  while (body.length > 0) {
    head = body.at(-1)!;
    const nextHead = { x: head.x + direction.x, y: head.y + direction.y };
    const nextBody = [...body.slice(1), nextHead];
    for (const point of nextBody) {
      const blocker = stationary.get(pointKey(point));
      if (blocker) return { ok: false, blockedBy: blocker };
    }
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
