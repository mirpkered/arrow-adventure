import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const catalogVersion = 'first-flight-r1';
const definitions = [
  ['Small Tangle', 'intro', 'abstract', 'Five short winding routes make a compact first tangle with two clear opening choices.'],
  ['Compact Maze', 'easy', 'abstract', 'Six crossing-looking but legally separated routes fill a skewed maze with a short dependency chain.'],
  ['Heart in the Weave', 'easy', 'silhouette', 'A dense heart-shaped footprint is drawn entirely by six winding arrows, including diagonal shoulders and a tapered point.'],
  ['Nested Paths', 'easy-medium', 'abstract', 'Seven nested routes share a broad oval footprint; each arrow remains internally simple and self-clear.'],
  ['Dense Weave', 'medium', 'abstract', 'Seven routes pack an irregular shared footprint with repeated close neighbors and layered escape dependencies.'],
  ['Star Crossing', 'medium', 'silhouette', 'Five winding paths collectively fill a stylized four-point star built from grid-aligned diagonals.'],
  ['Spiral Drift', 'medium', 'abstract', 'Eight interwoven paths occupy a broad C-shaped spiral footprint with a single deliberate opening.'],
  ['Broken Compass', 'medium', 'abstract', 'Eight routes fill an asymmetric, shifting footprint with several different safe removal orders.'],
  ['Evergreen', 'medium-hard', 'silhouette', 'Six winding arrows make a compact tiered canopy and trunk silhouette from the paths themselves.'],
  ['World Knot', 'hard', 'abstract', 'Nine long paths form the broadest weave, with multiple decision points and five dependency waves.'],
];

const levels = definitions.map(([title, difficulty, composition, designNote], index) => {
  const number = index + 1;
  const candidate = JSON.parse(readFileSync(resolve(root, `scripts/authoring/level${String(number).padStart(2, '0')}.json`), 'utf8'));
  candidate.level.number = number;
  return {
    id: `first-flight-${String(number).padStart(3, '0')}`,
    number,
    catalogVersion,
    contentVersion: 1,
    chapterId: 'first-flight',
    title,
    difficulty,
    composition,
    designNote,
    footprint: candidate.footprint,
    puzzle: candidate.level,
  };
});

writeFileSync(resolve(root, 'src/game/adventure-catalog.json'), JSON.stringify({
  catalogVersion,
  chapter: { id: 'first-flight', title: 'First Flight', levelIds: levels.map(({ id }) => id) },
  levels,
}, null, 2) + '\n');
