export type Point = { x: number; y: number };

export type Arrow = {
  id: string;
  /** Board-grid vertices ordered from tail to arrowhead; each step is one board unit. */
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
  | { ok: true; frames: Point[][]; travelDistance: number }
  | { ok: false; blockedBy: string; travelDistance: number };
