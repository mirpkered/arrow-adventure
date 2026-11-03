export type Point = { x: number; y: number };

export type Arrow = {
  id: string;
  /** Integer grid points defining the centerline, ordered from tail to arrowhead. */
  path: Point[];
};

export type Level = {
  number: number;
  width: number;
  height: number;
  arrows: Arrow[];
};

export type CuratedLevel = {
  id: string;
  number: number;
  title: string;
  difficulty: 'intro' | 'steady' | 'challenging';
  designNote: string;
  puzzle: Level;
};

export type MoveResult =
  | { ok: true; frames: Point[][] }
  | { ok: false; blockedBy: string };
