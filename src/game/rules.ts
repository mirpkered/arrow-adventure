import type { Arrow, Level, MoveResult, Point } from './types';

export const pointKey = ({ x, y }: Point): string => `${x},${y}`;

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
  if (last.x - previous.x !== 1 || last.y !== previous.y) throw new Error(`${arrow.id} must face east at its arrowhead`);
}

export function validateLevel(level: Level): void {
  if (level.arrows.length === 0) throw new Error(`Level ${level.number} is empty`);
  const occupied = new Map<string, string>();
  for (const arrow of level.arrows) {
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
export function simulateMove(arrow: Arrow, others: Arrow[], width: number): MoveResult {
  const stationary = new Map<string, string>();
  for (const other of others) for (const point of other.path) stationary.set(pointKey(point), other.id);

  let body = arrow.path.map((point) => ({ ...point }));
  const frames: Point[][] = [];
  let head = body.at(-1)!;
  const previous = body.at(-2)!;
  const direction = { x: head.x - previous.x, y: head.y - previous.y };
  if (direction.x !== 1 || direction.y !== 0) throw new Error(`${arrow.id} has an unsupported exit direction`);

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
    // Once the entire chain is outside the right edge, it has escaped.
    if (body.every((point) => point.x >= width)) return { ok: true, frames };
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
      const move = simulateMove(arrow, remaining.filter((other) => other.id !== arrow.id), level.width);
      if (!move.ok) continue;
      const tail = search(remaining.filter((other) => other.id !== arrow.id));
      if (tail) return [arrow.id, ...tail];
    }
    return null;
  };
  return search(initial);
}

export function completeLevel(arrows: Arrow[]): boolean { return arrows.length === 0; }

export function movedPathIsOffBoard(frames: Point[][], width: number): boolean {
  const finalFrame = frames.at(-1) ?? [];
  return finalFrame.length === 0 || finalFrame.every((point) => point.x >= width);
}
