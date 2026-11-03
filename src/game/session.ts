import type { Arrow, Level } from './types';

export type LevelRun = { arrows: Arrow[]; hearts: number };

export function createRun(level: Level): LevelRun {
  return {
    arrows: level.arrows.map((arrow) => ({ ...arrow, path: arrow.path.map((point) => ({ ...point })) })),
    hearts: 3,
  };
}

export function loseHeart(hearts: number): number { return Math.max(0, hearts - 1); }
