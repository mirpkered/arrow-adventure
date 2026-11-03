import type { Arrow, Level, Point } from './types';
import { solveLevel, validateLevel } from './rules';

const ARROW_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const COLORS = ['#df6250', '#427a9c', '#da9b36', '#688d62', '#986c9b', '#cf7658', '#4f9390', '#ab704f', '#6e7fb3', '#bb6475', '#73844a', '#d18a47'];

function tilePath(left: number, top: number): Point[] {
  // The head ends facing east. The three tight lanes form a clear, continuous
  // winding route and use every cell in this arrow's own 3 × 3 tile.
  return [
    { x: left, y: top + 2 }, { x: left + 1, y: top + 2 }, { x: left + 2, y: top + 2 },
    { x: left + 2, y: top + 1 }, { x: left + 1, y: top + 1 }, { x: left, y: top + 1 },
    { x: left, y: top }, { x: left + 1, y: top }, { x: left + 2, y: top },
  ];
}

function makeLevel(number: number, count: number): Level {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const arrows: Arrow[] = [];
  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    arrows.push({
      id: `l${number}-a${index + 1}`,
      color: COLORS[(index * 5 + number * 3) % COLORS.length],
      path: tilePath(column * 3, row * 3),
    });
  }
  // Seed is part of the saved level definition and is stable across releases.
  return { number, seed: 0xa22000 + number * 7919 + count, width: columns * 3, height: rows * 3, arrows };
}

export function generateLevels(): Level[] {
  return ARROW_COUNTS.map((count, index) => {
    const level = makeLevel(index + 1, count);
    validateLevel(level);
    if (!solveLevel(level)) throw new Error(`Generated level ${level.number} has no solution`);
    return level;
  });
}

export const LEVELS = generateLevels();
