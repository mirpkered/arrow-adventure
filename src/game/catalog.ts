import { analyzeLevel, solveLevel, validateLevel } from './rules';
import type { CuratedLevel, Level, Point } from './types';

/** Small, authored prototype set. Puzzle geometry is the source of truth; there is no runtime generator. */
const openingLevels: CuratedLevel[] = [
  {
    id: 'shared-board-001', number: 1, title: 'First tangle', difficulty: 'intro',
    designNote: 'Three close threads form a clear removal chain: c, then b, then a.',
    puzzle: { number: 1, width: 10, height: 8, arrows: [
      { id: 'a', path: [{ x: 1, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }] },
      { id: 'b', path: [{ x: 7, y: 2 }, { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }] },
      { id: 'c', path: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }] },
    ] },
  },
  {
    id: 'shared-board-002', number: 2, title: 'Nested turns', difficulty: 'intro',
    designNote: 'Four nested runs create a readable four-step dependency without isolated lanes.',
    puzzle: { number: 2, width: 12, height: 10, arrows: [
      { id: 'a', path: [{ x: 1, y: 7 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 4 }] },
      { id: 'b', path: [{ x: 7, y: 7 }, { x: 8, y: 7 }, { x: 8, y: 6 }, { x: 9, y: 6 }, { x: 9, y: 5 }, { x: 9, y: 4 }] },
      { id: 'c', path: [{ x: 6, y: 1 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 }, { x: 9, y: 2 }] },
      { id: 'd', path: [{ x: 10, y: 5 }, { x: 10, y: 4 }, { x: 10, y: 3 }, { x: 10, y: 2 }] },
    ] },
  },
];

function mapPuzzle(source: Level, number: number, width: number, height: number, map: (point: Point) => Point): Level {
  return { number, width, height, arrows: source.arrows.map((arrow) => ({ id: arrow.id, path: arrow.path.map(map) })) };
}

const nested = openingLevels[1].puzzle;
const clockwise = (point: Point): Point => ({ x: point.y, y: nested.width - 1 - point.x });
const mirrorX = (point: Point): Point => ({ x: nested.width - 1 - point.x, y: point.y });
const halfTurn = (point: Point): Point => ({ x: nested.width - 1 - point.x, y: nested.height - 1 - point.y });

export const CURATED_LEVELS: readonly CuratedLevel[] = [
  ...openingLevels,
  {
    id: 'shared-board-003', number: 3, title: 'Turn the weave', difficulty: 'steady',
    designNote: 'The nested dependency is turned upright; players must read the same close braid in a new orientation.',
    puzzle: mapPuzzle(nested, 3, nested.height, nested.width, clockwise),
  },
  {
    id: 'shared-board-004', number: 4, title: 'Back through', difficulty: 'steady',
    designNote: 'A mirrored braid reverses escape direction; a short fifth arrow gates the first dependency.',
    puzzle: (() => {
      const puzzle = mapPuzzle(nested, 4, nested.width, nested.height, mirrorX);
      puzzle.arrows.push({ id: 'e', path: [{ x: 2, y: 1 }, { x: 1, y: 1 }] });
      return puzzle;
    })(),
  },
  {
    id: 'shared-board-005', number: 5, title: 'Diagonal thread', difficulty: 'challenging',
    designNote: 'A diagonal approach joins the nested maze, and a fifth arrow extends its removal chain.',
    puzzle: (() => {
      const puzzle = mapPuzzle(nested, 5, nested.width, nested.height, (point) => ({ ...point }));
      puzzle.arrows.find(({ id }) => id === 'a')!.path.splice(1, 2, { x: 2, y: 6 });
      puzzle.arrows.push({ id: 'e', path: [{ x: 9, y: 0 }, { x: 10, y: 0 }] });
      return puzzle;
    })(),
  },
  {
    id: 'shared-board-006', number: 6, title: 'The tight braid', difficulty: 'challenging',
    designNote: 'The densest version nests a 14-segment lead route and links six arrows into one removal chain.',
    puzzle: (() => {
      const puzzle = mapPuzzle(nested, 6, nested.width, nested.height, halfTurn);
      const lead = puzzle.arrows.find(({ id }) => id === 'a')!;
      lead.path = [
        { x: 10, y: 1 }, { x: 10, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 1 },
        { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 1 },
        { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 3 },
        { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 5, y: 4 },
      ];
      puzzle.arrows.push(
        { id: 'e', path: [{ x: 0, y: 9 }, { x: 1, y: 9 }] },
        { id: 'f', path: [{ x: 2, y: 8 }, { x: 2, y: 9 }, { x: 3, y: 9 }] },
      );
      return puzzle;
    })(),
  },
];

const levelByNumber = new Map(CURATED_LEVELS.map((entry) => [entry.number, entry]));
const validDifficulties = new Set(['intro', 'steady', 'challenging']);

export function getCuratedLevel(number: number): CuratedLevel | undefined { return levelByNumber.get(number); }
export function getNextCuratedLevel(level: CuratedLevel): CuratedLevel | undefined { return levelByNumber.get(level.number + 1); }

export function validateCuratedLevels(entries: readonly CuratedLevel[] = CURATED_LEVELS): void {
  if (entries.length < 5 || entries.length > 10) throw new Error('Prototype catalog must contain between five and ten levels');
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id)) throw new Error(`Invalid or duplicate level ID: ${entry.id}`);
    if (!Number.isInteger(entry.number) || numbers.has(entry.number)) throw new Error(`Invalid or duplicate display number: ${entry.number}`);
    if (!validDifficulties.has(entry.difficulty)) throw new Error(`${entry.id} has invalid difficulty`);
    if (typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.designNote !== 'string' || !entry.designNote.trim()) throw new Error(`${entry.id} is missing authoring metadata`);
    if (entry.puzzle.number !== entry.number) throw new Error(`${entry.id} puzzle number does not match its catalog entry`);
    ids.add(entry.id);
    numbers.add(entry.number);
    validateLevel(entry.puzzle);
    const metrics = analyzeLevel(entry.puzzle);
    if (metrics.interleavedPairs < 1 || metrics.closeSegmentContacts < 8) throw new Error(`${entry.id} is too spatially separated to publish`);
    if (!solveLevel(entry.puzzle)) throw new Error(`${entry.id} has no complete solution`);
  }
  const ordered = [...entries].sort((left, right) => left.number - right.number);
  ordered.forEach((entry, index) => {
    if (entry.number !== index + 1) throw new Error('Prototype levels must be numbered contiguously from Level 1');
  });
}

validateCuratedLevels();
