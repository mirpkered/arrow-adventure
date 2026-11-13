export type Point = { x: number; y: number };

/**
 * Per-puzzle visible grid and path-local transform. `spacing` is the distance
 * between displayed intersections; `pathOffset` maps authored path vertices
 * into that board coordinate frame. Omitted specs keep the legacy half-unit grid.
 */
export type GridSpecification = {
  spacing: number;
  origin: Point;
  pathOffset: number;
  includeOuterBoundary: boolean;
};

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
  grid?: GridSpecification;
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
