import type { Arrow, Level } from './types';

export type LevelRun = { arrows: Arrow[]; hearts: number };
export type PrototypeSession = { levelNumber: number };
export type ProgressSessionKind = 'adventure' | 'prototype-review';

/** Prototype review runs share gameplay, but never write Adventure Mode saves. */
export function shouldPersistProgress(kind: ProgressSessionKind, busy: boolean): boolean {
  return kind === 'adventure' && !busy;
}

/** Every new page visit starts at Level 1; this state is never read from storage. */
export function createSession(): PrototypeSession { return { levelNumber: 1 }; }

export function advanceSession(session: PrototypeSession, levelCount: number): PrototypeSession | null {
  return session.levelNumber < levelCount ? { levelNumber: session.levelNumber + 1 } : null;
}

export function createRun(level: Level): LevelRun {
  return {
    arrows: level.arrows.map((arrow) => ({ ...arrow, path: arrow.path.map((point) => ({ ...point })) })),
    hearts: 3,
  };
}

export function loseHeart(hearts: number): number { return Math.max(0, hearts - 1); }
