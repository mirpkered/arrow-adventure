import { writeFileSync } from 'node:fs';

// Deterministic authoring helper. It packs each visible-grid intersection into
// a forest of non-crossing winding routes; the checked-in catalog, not this
// generator, is used at runtime. Final arrow directions are frozen per level.
const grid = { spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true };

function makeForest(width, height, arrowCount, seed) {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    let state = (seed + attempt * 0x9e3779b9) >>> 0;
    const random = () => { state = (state + 0x6d2b79f5) >>> 0; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 0x100000000; };
    const points = Array.from({ length: (width + 1) * (height + 1) }, (_, id) => ({ id, x: id % (width + 1), y: Math.floor(id / (width + 1)) }));
    const maximumRouteVertices = Math.ceil(points.length / arrowCount * 1.35);
    const parent = points.map(({ id }) => id); const size = points.map(() => 1); const degree = points.map(() => 0); const neighbors = points.map(() => []);
    const find = (id) => { while (parent[id] !== id) { parent[id] = parent[parent[id]]; id = parent[id]; } return id; };
    const edges = [];
    for (const point of points) {
      if (point.x < width) edges.push({ a: point.id, b: point.id + 1, dx: 1, dy: 0 });
      if (point.y < height) edges.push({ a: point.id, b: point.id + width + 1, dx: 0, dy: 1 });
    }
    let components = points.length; const chosen = [];
    while (components > arrowCount) {
      let best; let bestScore = -Infinity;
      for (const edge of edges) {
        if (degree[edge.a] >= 2 || degree[edge.b] >= 2) continue;
        const rootA = find(edge.a); const rootB = find(edge.b);
        if (rootA === rootB) continue;
        if (size[rootA] + size[rootB] > maximumRouteVertices) continue;
        const bendPreference = (id) => {
          if (degree[id] === 0) return 0;
          const previous = neighbors[id][0]; const previousPoint = points[previous]; const point = points[id];
          return previousPoint.x !== point.x && edge.dx === 0 || previousPoint.y !== point.y && edge.dy === 0 ? 0.38 : -0.08;
        };
        const merged = size[rootA] + size[rootB];
        const target = points.length / arrowCount;
        const score = random() + bendPreference(edge.a) + bendPreference(edge.b)
          + (size[rootA] === 1 ? 1.8 : 0) + (size[rootB] === 1 ? 1.8 : 0)
          - Math.max(0, merged - target * 1.5) * 0.04 - Math.abs(size[rootA] - size[rootB]) * 0.008;
        if (score > bestScore) { best = { ...edge, rootA, rootB }; bestScore = score; }
      }
      if (!best) break;
      parent[best.rootB] = best.rootA; size[best.rootA] += size[best.rootB];
      degree[best.a] += 1; degree[best.b] += 1;
      neighbors[best.a].push(best.b); neighbors[best.b].push(best.a);
      chosen.push(best); components -= 1;
    }
    if (components !== arrowCount || points.some(({ id }) => degree[id] === 0)) continue;
    const routes = [];
    const visited = new Set();
    for (const point of points.filter(({ id }) => degree[id] === 1).sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (visited.has(point.id)) continue;
      const path = []; let previous = -1; let current = point.id;
      while (current >= 0 && !visited.has(current)) {
        visited.add(current); path.push({ x: points[current].x, y: points[current].y });
        const next = neighbors[current].find((id) => id !== previous);
        previous = current; current = next ?? -1;
      }
      routes.push(path);
    }
    if (routes.length !== arrowCount || visited.size !== points.length || routes.some((path) => path.length < 2)) continue;
    // Stable visual-order IDs, independent of runtime catalog array identity.
    routes.sort((a, b) => {
      const centroid = (path, axis) => path.reduce((sum, point) => sum + point[axis], 0) / path.length;
      return centroid(a, 'y') - centroid(b, 'y') || centroid(a, 'x') - centroid(b, 'x') || a.length - b.length;
    });
    return routes;
  }
  throw new Error(`Could not pack ${arrowCount} non-crossing routes into ${width}×${height} visible cells`);
}

const designs = [
  { number: 1, width: 5, height: 5, title: 'First Steps', difficulty: 'intro', prefix: 'a', count: 5, seed: 1128, reversedArrows: [0, 1, 3], contentVersion: 2, note: 'A small mixed-orientation route field keeps the first exits readable while sharing the center and perimeter corridors.' },
  { number: 2, width: 6, height: 6, title: 'Close Quarters', difficulty: 'easy', prefix: 'b', count: 8, seed: 2249, reversedArrows: [3, 5, 7], contentVersion: 2, note: 'Eight short-to-medium routes fill adjacent corridors with offset bends and several early escape choices.' },
  { number: 3, width: 7, height: 7, title: 'Winding Paths', difficulty: 'easy-medium', prefix: 'c', count: 10, seed: 3301, reversedArrows: [3, 9], contentVersion: 3, note: 'A compact seven-cell route field mixes nested hooks with longer paths and several coordinated interior bends.' },
  { number: 4, width: 7, height: 8, title: 'The Weave', difficulty: 'medium', prefix: 'd', count: 12, seed: 4421, reversedArrows: [2, 4, 9], contentVersion: 2, note: 'A taller packed route composition adds crossing exit dependencies while maintaining distinct, non-touching centerlines.' },
  { number: 5, width: 8, height: 8, title: 'First Challenge', difficulty: 'medium-hard', prefix: 'e', count: 15, seed: 5521, reversedArrows: [3, 6, 7, 11], contentVersion: 2, note: 'The densest board combines short pockets and longer irregular paths across the full square footprint.' },
];

const catalogVersion = 'first-flight-r3-compact-weave';
const levels = designs.map(({ number, width, height, title, difficulty, prefix, count, seed, reversedArrows, contentVersion, note }) => {
  const arrows = makeForest(width, height, count, seed).map((rawPath, index) => {
    const path = reversedArrows.includes(index) ? [...rawPath].reverse() : rawPath;
    return { id: `${prefix}${String(index + 1).padStart(2, '0')}`, path };
  });
  return {
    id: `first-flight-${String(number).padStart(3, '0')}`,
    number,
    catalogVersion,
    contentVersion,
    chapterId: 'first-flight',
    title,
    difficulty,
    composition: 'abstract',
    designNote: note,
    footprint: [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]],
    puzzle: { number, width, height, grid, arrows },
  };
});

const catalog = { catalogVersion, chapter: { id: 'first-flight', title: 'First Flight', levelIds: levels.map(({ id }) => id) }, levels };
writeFileSync(new URL('../../src/game/adventure-catalog.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${levels.length} deterministic compact-weave levels (${catalogVersion}).`);
