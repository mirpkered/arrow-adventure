export type Point = { x: number; y: number };

export type Arrow = {
  id: string;
  color: string;
  /** Occupied cells, ordered from tail to arrowhead. */
  path: Point[];
};

export type Level = {
  number: number;
  /** Optional for authored levels; generated legacy levels retain their seed. */
  seed?: number;
  width: number;
  height: number;
  arrows: Arrow[];
};

export type MoveResult =
  | { ok: true; frames: Point[][] }
  | { ok: false; blockedBy: string };

export type SaveData = {
  schemaVersion: 2;
  highestUnlockedLevelId: string;
  selectedLevelId: string;
  /** Stable IDs retain credit when the same published level gets a new content version. */
  completedLevelIds: string[];
};
