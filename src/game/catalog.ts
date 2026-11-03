import { solveLevel, validateLevel } from './rules';
import type { CuratedLevel } from './types';

/** Small, authored prototype set. Puzzle geometry is the source of truth; there is no runtime generator. */
export const CURATED_LEVELS: readonly CuratedLevel[] = [
  {
    id: 'shared-board-001', number: 1, title: 'First crossing', difficulty: 'intro',
    designNote: 'A clear two-arrow dependency introduces shared exit lanes.',
    puzzle: { number: 1, width: 8, height: 7, arrows: [
      { id: 'a', path: [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 }] },
      { id: 'b', path: [{ x: 6, y: 4 }, { x: 6, y: 3 }] },
    ] },
  },
  {
    id: 'shared-board-002', number: 2, title: 'Unthread the line', difficulty: 'intro',
    designNote: 'A winding exit chain rewards reading beyond the nearest arrowhead.',
    puzzle: { number: 2, width: 10, height: 8, arrows: [
      { id: 'a', path: [{ x: 1, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }] },
      { id: 'b', path: [{ x: 7, y: 5 }, { x: 7, y: 4 }] },
      { id: 'c', path: [{ x: 8, y: 1 }, { x: 8, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 1 }, { x: 6, y: 1 }] },
    ] },
  },
  {
    id: 'shared-board-003', number: 3, title: 'Four links', difficulty: 'steady',
    designNote: 'A four-step dependency chain uses both vertical and horizontal lanes.',
    puzzle: { number: 3, width: 11, height: 10, arrows: [
      { id: 'a', path: [{ x: 1, y: 7 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }] },
      { id: 'b', path: [{ x: 8, y: 7 }, { x: 8, y: 6 }] },
      { id: 'c', path: [{ x: 8, y: 1 }, { x: 7, y: 1 }] },
      { id: 'd', path: [{ x: 4, y: 2 }, { x: 4, y: 1 }] },
    ] },
  },
  {
    id: 'shared-board-004', number: 4, title: 'Two threads', difficulty: 'steady',
    designNote: 'Two independent chains create a choice of which side to unwind first; the main route includes a diagonal bend.',
    puzzle: { number: 4, width: 12, height: 10, arrows: [
      { id: 'a', path: [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }] },
      { id: 'b', path: [{ x: 8, y: 5 }, { x: 8, y: 4 }] },
      { id: 'c', path: [{ x: 9, y: 1 }, { x: 9, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 7, y: 1 }] },
      { id: 'd', path: [{ x: 4, y: 2 }, { x: 4, y: 1 }] },
      { id: 'e', path: [{ x: 10, y: 8 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 9, y: 8 }, { x: 8, y: 8 }] },
    ] },
  },
  {
    id: 'shared-board-005', number: 5, title: 'The long way around', difficulty: 'challenging',
    designNote: 'A longer dependency chain mixes diagonal turns with separated exit corridors.',
    puzzle: { number: 5, width: 12, height: 10, arrows: [
      { id: 'a', path: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }] },
      { id: 'b', path: [{ x: 9, y: 6 }, { x: 9, y: 5 }] },
      { id: 'c', path: [{ x: 10, y: 1 }, { x: 10, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 1 }, { x: 8, y: 1 }] },
      { id: 'd', path: [{ x: 5, y: 2 }, { x: 5, y: 1 }] },
      { id: 'e', path: [{ x: 10, y: 8 }, { x: 11, y: 8 }, { x: 11, y: 9 }] },
    ] },
  },
  {
    id: 'shared-board-006', number: 6, title: 'Shared space', difficulty: 'challenging',
    designNote: 'Two crossing dependency chains give several safe openings and combine long, winding paths with diagonal turns.',
    puzzle: { number: 6, width: 12, height: 12, arrows: [
      { id: 'a', path: [{ x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 4, y: 8 }, { x: 5, y: 8 }] },
      { id: 'b', path: [{ x: 10, y: 8 }, { x: 10, y: 7 }] },
      { id: 'c', path: [{ x: 10, y: 2 }, { x: 9, y: 2 }] },
      { id: 'd', path: [{ x: 5, y: 3 }, { x: 5, y: 2 }] },
      { id: 'e', path: [{ x: 10, y: 10 }, { x: 10, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }] },
      { id: 'f', path: [{ x: 2, y: 9 }, { x: 2, y: 10 }] },
    ] },
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
    if (!solveLevel(entry.puzzle)) throw new Error(`${entry.id} has no complete solution`);
  }
  const ordered = [...entries].sort((left, right) => left.number - right.number);
  ordered.forEach((entry, index) => {
    if (entry.number !== index + 1) throw new Error('Prototype levels must be numbered contiguously from Level 1');
  });
}

validateCuratedLevels();
