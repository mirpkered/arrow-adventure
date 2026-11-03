export type Point = { x: number; y: number };

export type Arrow = {
  id: string;
  color: string;
  /** Occupied cells, ordered from tail to arrowhead. */
  path: Point[];
};

export type Level = {
  number: number;
  seed: number;
  width: number;
  height: number;
  arrows: Arrow[];
};

export type MoveResult =
  | { ok: true; frames: Point[][] }
  | { ok: false; blockedBy: string };

export type SaveData = {
  highestUnlocked: number;
  completed: number[];
};
