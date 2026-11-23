import { writeFileSync } from 'node:fs';

// Frozen, composition-authored Round 10 content. This is an authoring-time
// serializer only; Adventure Mode imports the checked-in JSON, never generates.
const grid = { spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true };
const point = (value) => {
  const [x, y] = value.split(',').map(Number);
  return { x, y };
};
const route = (text) => text.split(' ').map(point);
const definitions = [
  {
    number: 1, width: 5, height: 5, title: 'First Steps', difficulty: 'intro',
    note: 'Five short routes form a compact first tangle, with two clear opening choices and a short dependency chain.',
    arrows: [
      ['a01','0,2 1,2 1,1 2,1 2,2 3,2'],
      ['a02','3,3 4,3 4,2'],
      ['a03','0,3 1,3 1,4 2,4 3,4 4,4 5,4'],
      ['a04','5,3 5,2 5,1 5,0'],
      ['a05','0,0 1,0 2,0 3,0 3,1 4,1'],
    ],
  },
  {
    number: 2, width: 6, height: 6, title: 'Close Quarters', difficulty: 'easy',
    note: 'A compact turning cluster uses edge exits and short interior hooks to create several linked removal choices.',
    arrows: [
      ['b01','1,1 2,1 3,1 3,2 2,2 2,3 3,3'],
      ['b02','5,4 5,5 4,5 4,4 4,3'],
      ['b03','4,0 4,1 4,2 5,2 6,2'],
      ['b04','1,5 2,5 3,5'],
      ['b05','0,1 0,0 1,0 2,0'],
      ['b06','0,2 0,3 0,4 0,5'],
      ['b07','1,4 2,4 3,4'],
      ['b08','6,4 6,5 6,6'],
    ],
  },
  {
    number: 3, width: 7, height: 7, title: 'Winding Paths', difficulty: 'easy-medium',
    note: 'Nested central bends and compact side routes add path-reading complexity without relying on diagonals.',
    arrows: [
      ['c01','2,2 3,2 3,3 2,3 2,4 3,4'],
      ['c02','5,4 5,5 4,5 4,4'],
      ['c03','4,0 4,1 4,2 5,2 6,2'],
      ['c04','0,6 0,5 0,4 1,4 1,3 1,2'],
      ['c05','7,0 7,1 7,2 7,3'],
      ['c06','7,4 6,4 6,5 7,5'],
      ['c07','1,0 2,0 3,0'],
      ['c08','0,0 0,1 0,2 0,3'],
      ['c09','1,7 1,6 2,6 3,6 4,6 5,6 5,7'],
      ['c10','6,6 6,7 7,7'],
    ],
  },
  {
    number: 4, width: 7, height: 8, title: 'The Weave', difficulty: 'medium',
    note: 'A denser rectangular weave interlaces a central hook, paired side bends, and long boundary routes; all arrows remain individually clear.',
    arrows: [
      ['d01','1,1 2,1 3,1 3,2 2,2 2,3 3,3 4,3'],
      ['d02','5,5 5,4 5,3 6,3'],
      ['d03','7,3 7,4 7,5'],
      ['d04','1,7 2,7 3,7 4,7 5,7'],
      ['d05','6,7 6,6 6,5 6,4'],
      ['d06','0,5 1,5 2,5 2,6 1,6 0,6'],
      ['d07','0,0 0,1 0,2 1,2 1,3 0,3'],
      ['d08','3,0 4,0 5,0 5,1 4,1 4,2 5,2 6,2'],
      ['d09','3,4 3,5 4,5 4,6 3,6'],
      ['d10','0,4 1,4 2,4'],
      ['d11','0,8 1,8 2,8 3,8'],
      ['d12','5,8 6,8 7,8'],
    ],
  },
  {
    number: 5, width: 8, height: 8, title: 'First Challenge', difficulty: 'medium-hard',
    note: 'The weave spreads into an added outer corridor. A short linked exit chain joins the core routes, while varied hooks and bottom-edge paths create several legal openings.',
    arrows: [
      ['e01','1,1 2,1 3,1 3,2 2,2 2,3 3,3 4,3'],
      ['e02','5,5 5,4 5,3 6,3'],
      ['e03','7,3 7,4 7,5'],
      ['e04','1,7 2,7 3,7 4,7 5,7 5,6'],
      ['e05','6,7 6,6 6,5 6,4'],
      ['e06','0,5 1,5 2,5 2,6 1,6 0,6'],
      ['e07','0,0 0,1 0,2 1,2 1,3 0,3'],
      ['e08','3,0 4,0 5,0 5,1 4,1 4,2 5,2 6,2'],
      ['e09','3,4 3,5 4,5 4,6 3,6'],
      ['e10','0,4 1,4 2,4'],
      ['e11','0,8 1,8 2,8 3,8'],
      ['e12','5,8 6,8 7,8'],
      ['e13','7,2 8,2 8,3'],
      ['e14','8,0 7,0 6,0'],
      ['e15','8,5 8,6 8,7 8,8'],
    ],
  },
];

const catalogVersion = 'first-flight-r2-true-grid';
const levels = definitions.map((definition) => {
  const { number, width, height, title, difficulty, note, arrows } = definition;
  return {
    id: `first-flight-${String(number).padStart(3, '0')}`,
    number,
    catalogVersion,
    contentVersion: 1,
    chapterId: 'first-flight',
    title,
    difficulty,
    composition: 'abstract',
    designNote: note,
    footprint: [[point('0,0'), point(`${width},0`), point(`${width},${height}`), point(`0,${height}`)]],
    puzzle: { number, width, height, grid, arrows: arrows.map(([id, path]) => ({ id, path: route(path) })) },
  };
});
const catalog = {
  catalogVersion,
  chapter: { id: 'first-flight', title: 'First Flight', levelIds: levels.map(({ id }) => id) },
  levels,
};
writeFileSync(new URL('../../src/game/adventure-catalog.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${levels.length} deterministic true-grid levels (${catalogVersion}).`);
