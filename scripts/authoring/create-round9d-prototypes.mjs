import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'src/game/prototypes/round9d-prototypes.json');

function walk(waypoints) {
  const path = [{ x: waypoints[0][0], y: waypoints[0][1] }];
  for (let index = 1; index < waypoints.length; index += 1) {
    const [x1, y1] = waypoints[index - 1];
    const [x2, y2] = waypoints[index];
    const dx = x2 - x1; const dy = y2 - y1;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (!Number.isInteger(steps) || steps < 1 || (Math.abs(dx) > 0 && Math.abs(dy) > 0 && Math.abs(Math.abs(dx) - Math.abs(dy)) > 1e-8)) {
      throw new Error(`Unsupported authoring segment (${x1},${y1}) → (${x2},${y2})`);
    }
    for (let step = 1; step <= steps; step += 1) {
      path.push({ x: x1 + dx / steps * step, y: y1 + dy / steps * step });
    }
  }
  return path;
}

function arrows(prefix, routes) {
  return routes.map((route, index) => ({ id: `${prefix}${String(index + 1).padStart(2, '0')}`, path: walk(route) }));
}

const D = {
  id: 'round9d-micro-arrow-field', name: 'Micro-Arrow Field', difficulty: 'Easy–Medium',
  purpose: 'A compact field of short straight, hooked, and diagonal arrows. Four aligned rows make each arrow readable while the facing direction and corridor order create small, deliberate removal chains.',
  compositionStyle: 'Micro-arrow grid',
  compositionPlan: 'Use a five-by-four half-grid field. Keep most routes one to two cells long; vary hooks and a few diagonal exits. Align row exits so each row clears from its exposed edge inward, with one diagonal end arrow opening the row.',
  previewCaption: 'Twenty short routes fill a compact micro-arrow field with four clear row chains.',
  footprint: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }]],
  puzzle: { number: 4, width: 11, height: 9, arrows: arrows('d', [
    [[0.5, 1.5], [0.5, 0.5], [1.5, 0.5]], [[2.5, 0.5], [3.5, 0.5]], [[4.5, 1.5], [4.5, 0.5], [5.5, 0.5]], [[6.5, 0.5], [7.5, 0.5]], [[8.5, 1.5], [9.5, 0.5]],
    [[1.5, 3], [0.5, 2]], [[3.5, 3], [3.5, 2], [2.5, 2]], [[5.5, 2], [4.5, 2]], [[7.5, 3], [7.5, 2], [6.5, 2]], [[9.5, 2], [8.5, 2]],
    [[0.5, 3.5], [1.5, 3.5]], [[2.5, 4.5], [2.5, 3.5], [3.5, 3.5]], [[4.5, 3.5], [5.5, 3.5]], [[6.5, 4.5], [6.5, 3.5], [7.5, 3.5]], [[8.5, 2.5], [9.5, 3.5]],
    [[1.5, 6], [0.5, 5]], [[3.5, 6], [3.5, 5], [2.5, 5]], [[5.5, 5], [4.5, 5]], [[7.5, 6], [7.5, 5], [6.5, 5]], [[9.5, 5], [8.5, 5]],
  ]) },
};

const E = {
  id: 'round9d-dense-interwoven-maze', name: 'Dense Interwoven Maze', difficulty: 'Medium',
  purpose: 'A compact, slanted weave combining hooked upper corridors, a diagonal wave through the middle, an irregular lower return, and short arrows that sit in the openings.',
  compositionStyle: 'Dense interwoven maze',
  compositionPlan: 'Build four offset long routes before filling the gaps: a hooked crown, a zigzag diagonal crossing the middle, a notched return, and a lower irregular run. Place tiny blockers on selected exit rays. Keep each main route visually close to the next without crossing.',
  previewCaption: 'A hooked crown, diagonal middle wave, notched return, and short blockers form a compact weave.',
  footprint: [[{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 5 }, { x: 13, y: 8 }, { x: 14, y: 11 }, { x: 12, y: 12 }, { x: 1, y: 12 }, { x: 0, y: 9 }, { x: 1, y: 6 }]],
  puzzle: { number: 5, width: 16, height: 13, arrows: arrows('e', [
    [[13, 10], [12, 9], [13, 9], [12, 8], [13, 7], [12, 7], [11, 8]],
    [[4.5, 9.5], [4.5, 8.5], [5.5, 7.5], [5.5, 8.5], [6.5, 7.5], [6.5, 8.5]],
    [[11.5, 7], [10.5, 6], [10.5, 7], [9.5, 7], [9.5, 8], [10.5, 9], [10.5, 10], [9.5, 9], [8.5, 8], [8.5, 7], [7.5, 6]],
    [[12.5, 5.5], [12.5, 4.5], [11.5, 3.5], [10.5, 2.5], [11.5, 1.5], [11.5, 2.5], [12.5, 3.5], [13.5, 2.5], [12.5, 2.5], [12.5, 1.5]],
    [[1.5, 4.5], [2.5, 3.5], [2.5, 2.5], [3.5, 3.5], [4.5, 3.5]],
    [[1.5, 7.5], [0.5, 7.5], [1.5, 6.5], [1.5, 5.5], [0.5, 6.5], [0.5, 5.5], [0.5, 4.5], [1.5, 3.5], [1.5, 2.5], [0.5, 3.5], [0.5, 2.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5], [1.5, 0.5], [2.5, 1.5], [3.5, 1.5]],
    [[2, 5], [2, 6], [3, 7], [2, 7], [2, 8], [1, 8], [2, 9], [1, 9], [1, 10], [2, 10], [3, 9], [4, 8], [4, 7]],
    [[6, 4.5], [5, 4.5], [6, 3.5], [7, 3.5], [8, 4.5], [7, 4.5], [6, 5.5], [7, 6.5], [8, 7.5], [7, 8.5], [8, 9.5], [8, 8.5], [9, 9.5], [9, 10.5], [10, 11.5]],
    [[8.5, 5], [9.5, 6], [8.5, 6], [7.5, 5]],
    [[13, 8], [14, 9], [14, 8], [14, 7], [14, 6], [13, 5], [13, 6], [12, 6], [12, 5]],
    [[13.5, 9], [13.5, 10], [12.5, 11], [13.5, 11], [13.5, 12], [12.5, 12], [11.5, 11], [10.5, 12], [9.5, 12], [8.5, 12], [8.5, 11], [7.5, 11], [8.5, 10], [7.5, 10], [6.5, 11], [6.5, 12], [5.5, 11], [4.5, 11], [5.5, 12]],
  ]) },
};

const F = {
  id: 'round9d-tree-silhouette', name: 'Tree Silhouette', difficulty: 'Medium',
  purpose: 'An original evergreen-like image made only from arrows: stepped canopy edges, irregular branch tiers, inner twigs, and a split trunk with small roots.',
  compositionStyle: 'Recognizable silhouette',
  compositionPlan: 'Start with two asymmetric diagonal canopy edges, then place shorter branches inside a tapering crown. Use a separate trunk and small root strokes; never add an outline, image, or background shape to the playable board.',
  previewCaption: 'Arrow-built canopy, branch tiers, trunk, and roots form an original tree silhouette.',
  footprint: [[{ x: 6, y: 0 }, { x: 8, y: 0 }, { x: 11, y: 2 }, { x: 13, y: 5 }, { x: 11, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 14 }, { x: 5, y: 14 }, { x: 5, y: 8 }, { x: 2, y: 8 }, { x: 0, y: 5 }, { x: 2, y: 2 }]],
  puzzle: { number: 6, width: 14, height: 15, arrows: arrows('f', [
    [[6, 0.5], [5, 1.5], [4, 1.5], [5, 2.5], [3, 2.5], [4, 3.5], [2, 3.5], [3, 4.5], [1, 4.5], [2, 5.5], [1, 5.5]],
    [[7, 0.5], [8, 1.5], [9, 1.5], [8, 2.5], [10, 2.5], [9, 3.5], [11, 3.5], [10, 4.5], [12, 4.5], [11, 5.5], [12, 5.5]],
    [[6, 2.5], [7, 2.5]],
    [[5, 3.5], [5, 4.5], [6, 4.5], [7, 4.5]],
    [[8, 4.5], [8, 3.5]],
    [[4, 5.5], [8, 5.5]],
    [[2.5, 6.5], [3.5, 6.5], [3.5, 7.5], [5.5, 7.5]],
    [[10.5, 7.5], [10.5, 6.5]],
    [[6, 9], [6, 10], [6, 11], [6, 12], [6, 13]],
    [[7, 12], [7, 11], [7, 10]],
    [[5, 13], [4, 13], [4, 12]],
    [[8, 13], [9, 13], [9, 12]],
  ]) },
};

const G = {
  id: 'round9d-large-mixed-weave', name: 'Large Mixed-Length Weave', difficulty: 'Hard',
  purpose: 'A large, irregular all-direction weave where long angular routes, medium braids, and short internal arrows occupy one connected visual footprint.',
  compositionStyle: 'Large mixed-length weave',
  compositionPlan: 'Search seeded self-avoiding route packs using the gameplay geometry, then select and freeze a high-contact candidate with mixed path lengths, multiple exit directions, and a complete exact audit. Refine the final layout as a broad, asymmetrical mesh rather than a nested spiral.',
  previewCaption: 'A selected 13-arrow pack combines winding corridors, short routes, and a deep removal chain.',
  footprint: [[{ x: 0, y: 0 }, { x: 19, y: 0 }, { x: 19, y: 14 }, { x: 0, y: 14 }]],
  puzzle: { number: 7, width: 20, height: 15, arrows: arrows('g', [
    [[6, 5.5], [6, 6.5], [7, 5.5], [7, 6.5], [8, 7.5], [7, 8.5], [7, 9.5], [8, 9.5], [8, 8.5], [9, 8.5], [9, 7.5], [10, 8.5], [11, 8.5]],
    [[9, 9], [8, 10], [8, 11], [9, 11], [9, 12], [10, 12], [9, 13], [10, 13], [11, 12], [12, 11], [13, 11], [12, 10], [12, 9], [13, 8], [13, 7], [12, 6], [13, 5], [14, 4]],
    [[6, 8], [5, 9], [6, 9]],
    [[7, 4.5], [8, 5.5], [9, 4.5], [9, 5.5], [8, 6.5], [9, 6.5], [10, 7.5], [11, 6.5], [11, 5.5], [12, 4.5], [11, 4.5], [10, 3.5], [10, 2.5], [9, 1.5], [9, 2.5], [8, 3.5], [9, 3.5], [8, 4.5], [7, 3.5]],
    [[15.5, 6], [14.5, 7], [15.5, 8], [14.5, 8], [13.5, 9], [13.5, 8], [12.5, 9], [13.5, 10], [14.5, 9], [15.5, 9], [14.5, 10], [15.5, 10], [15.5, 11], [14.5, 12], [14.5, 13]],
    [[6.5, 9.5], [5.5, 10.5], [4.5, 10.5], [3.5, 11.5]],
    [[12.5, 10], [13.5, 11], [14.5, 11], [13.5, 12], [13.5, 13]],
    [[11.5, 12], [12.5, 12], [11.5, 13], [12.5, 13], [13.5, 14], [14.5, 14], [15.5, 13], [16.5, 14], [17.5, 13]],
    [[7, 10], [6, 11], [6, 12], [5, 11], [5, 12], [6, 13], [6, 14], [5, 13], [5, 14], [4, 14], [3, 13]],
    [[11, 2], [12, 3], [12, 2], [11, 1], [10, 1]],
    [[4.5, 13.5], [4.5, 12.5], [3.5, 12.5], [2.5, 11.5], [3.5, 10.5], [2.5, 10.5], [1.5, 10.5]],
    [[11, 4], [12, 4], [11, 3], [10, 2], [9, 1], [8, 2], [8, 1], [7, 1]],
    [[16, 10], [16, 11], [15, 12], [16, 13], [16, 12], [17, 12], [18, 11], [19, 11], [18, 10], [18, 9], [17, 8], [17, 7], [18, 6], [19, 7], [19, 6], [18, 5], [17, 5]],
  ]) },
};

const H = {
  id: 'round9d-framed-composition', name: 'Framed Composition', difficulty: 'Medium–Hard',
  purpose: 'An irregular frame of interlocking arrows surrounds a large, deliberate central opening. The open region is part of the design, not a density failure.',
  compositionStyle: 'Framed negative space',
  compositionPlan: 'Draw an uneven top, right, bottom, and left band around a clear central window. Vary the band routes and arrow lengths; preserve the window as intentional negative space while using it as a readable visual anchor.',
  previewCaption: 'Dense, varied border routes frame an intentionally open center.',
  footprint: [[{ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 3.5 }, { x: 12.5, y: 3.5 }, { x: 12.5, y: 8.5 }, { x: 15, y: 8.5 }, { x: 15, y: 12 }, { x: 0, y: 12 }, { x: 0, y: 8.5 }, { x: 4.5, y: 8.5 }, { x: 4.5, y: 3.5 }, { x: 0, y: 3.5 }]],
  puzzle: { number: 8, width: 16, height: 13, arrows: arrows('h', [
    [[3.5, 3], [3.5, 1], [4.5, 1], [4.5, 2], [7.5, 2], [7.5, 1], [13.5, 1]],
    [[5, 3.5], [5, 2.5], [6, 2.5], [6, 3.5], [10, 3.5], [10, 2.5], [12, 2.5]],
    [[14, 1.5], [15, 1.5], [15, 3.5], [14, 3.5], [14, 7.5], [15, 7.5], [15, 10.5], [12, 10.5]],
    [[12.5, 3.5], [13.5, 3.5], [13.5, 8.5], [12.5, 8.5]],
    [[12, 9.5], [9, 9.5], [9, 8.5], [5, 8.5], [5, 9.5], [2, 9.5]],
    [[12.5, 11.5], [8.5, 11.5], [8.5, 10.5], [4.5, 10.5], [4.5, 11.5], [1.5, 11.5]],
    [[0.5, 10], [0.5, 6], [1.5, 6], [1.5, 2], [2.5, 2]],
    [[3.5, 3.5], [4.5, 3.5], [4.5, 8.5], [3.5, 8.5]],
  ]) },
};

const prototypes = [D, E, F, G, H];
const current = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : [];
writeFileSync(output, `${JSON.stringify(prototypes, null, 2)}\n`);
console.log(`${current.length ? 'Regenerated' : 'Wrote'} ${prototypes.length} deterministic Round 9D prototype candidates to ${output}`);
