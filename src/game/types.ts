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
  catalogVersion: string;
  contentVersion: number;
  chapterId: string;
  title: string;
  difficulty: 'intro' | 'easy' | 'easy-medium' | 'medium' | 'medium-hard' | 'hard';
  designNote: string;
  composition: 'abstract' | 'silhouette';
  /** One or more simple polygons in path-local board coordinates; authored, never inferred from arrow bounds. */
  footprint: Point[][];
  puzzle: Level;
};

export type MoveResult =
  | { ok: true; frames: Point[][]; travelDistance: number }
  | { ok: false; blockedBy: string; travelDistance: number };
