import type { Level, Point } from '../types';

/**
 * Deterministic offline composition aid. It partitions the full orthogonal
 * visible-intersection lattice into disjoint winding routes. Output is only a
 * candidate: geometry, dependencies, screenshots, and the frozen definition
 * still require review before publication.
 */
export function generateGridForest(width: number, height: number, arrowCount: number, seed: number): Level {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1
    || !Number.isInteger(arrowCount) || arrowCount < 1 || arrowCount >= (width + 1) * (height + 1)) {
    throw new Error('Grid-forest dimensions and arrow count are invalid');
  }
  const pointCount = (width + 1) * (height + 1);
  const maximumVertices = Math.ceil(pointCount / arrowCount * 1.35);
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const random = seededRandom((seed + Math.imul(attempt, 0x9e3779b9)) >>> 0);
    const points = Array.from({ length: pointCount }, (_, id) => ({ id, x: id % (width + 1), y: Math.floor(id / (width + 1)) }));
    const parent = points.map(({ id }) => id);
    const size = points.map(() => 1);
    const degree = points.map(() => 0);
    const neighbors = points.map(() => [] as number[]);
    const find = (input: number): number => {
      let id = input;
      while (parent[id] !== id) { parent[id] = parent[parent[id]]; id = parent[id]; }
      return id;
    };
    const edges: Array<{ a: number; b: number }> = [];
    for (const point of points) {
      if (point.x < width) edges.push({ a: point.id, b: point.id + 1 });
      if (point.y < height) edges.push({ a: point.id, b: point.id + width + 1 });
    }
    let components = pointCount;
    while (components > arrowCount) {
      let best: { a: number; b: number; rootA: number; rootB: number } | undefined;
      let bestScore = -Infinity;
      for (const edge of edges) {
        if (degree[edge.a] >= 2 || degree[edge.b] >= 2) continue;
        const rootA = find(edge.a); const rootB = find(edge.b);
        if (rootA === rootB || size[rootA] + size[rootB] > maximumVertices) continue;
        const bendPreference = (id: number): number => {
          if (degree[id] === 0) return 0;
          const previous = points[neighbors[id][0]]; const point = points[id]; const next = points[edge.a === id ? edge.b : edge.a];
          const turns = previous.x !== point.x ? next.y !== point.y : next.x !== point.x;
          return turns ? 0.4 : -0.08;
        };
        const merged = size[rootA] + size[rootB];
        const target = pointCount / arrowCount;
        const score = random() + bendPreference(edge.a) + bendPreference(edge.b)
          + (size[rootA] === 1 ? 1.8 : 0) + (size[rootB] === 1 ? 1.8 : 0)
          - Math.max(0, merged - target * 1.5) * 0.04 - Math.abs(size[rootA] - size[rootB]) * 0.008;
        if (score > bestScore) { best = { ...edge, rootA, rootB }; bestScore = score; }
      }
      if (!best) break;
      parent[best.rootB] = best.rootA; size[best.rootA] += size[best.rootB];
      degree[best.a] += 1; degree[best.b] += 1;
      neighbors[best.a].push(best.b); neighbors[best.b].push(best.a);
      components -= 1;
    }
    if (components !== arrowCount || degree.some((value) => value === 0)) continue;

    const routes: Point[][] = [];
    const visited = new Set<number>();
    for (const point of points.filter(({ id }) => degree[id] === 1).sort((left, right) => left.y - right.y || left.x - right.x)) {
      if (visited.has(point.id)) continue;
      const path: Point[] = [];
      let previous = -1; let current = point.id;
      while (current >= 0 && !visited.has(current)) {
        visited.add(current);
        path.push({ x: points[current].x, y: points[current].y });
        const next = neighbors[current].find((id) => id !== previous);
        previous = current; current = next ?? -1;
      }
      routes.push(path);
    }
    if (routes.length !== arrowCount || visited.size !== pointCount || routes.some((path) => path.length < 2)) continue;
    routes.sort((left, right) => centroid(left, 'y') - centroid(right, 'y') || centroid(left, 'x') - centroid(right, 'x') || left.length - right.length);
    return {
      number: 0, width, height,
      grid: { spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true },
      arrows: routes.map((path, index) => ({ id: `g${String(index + 1).padStart(2, '0')}`, path })),
    };
  }
  throw new Error(`Could not partition the ${width}×${height} intersection lattice into ${arrowCount} winding routes`);
}

function centroid(path: Point[], axis: 'x' | 'y'): number { return path.reduce((sum, point) => sum + point[axis], 0) / path.length; }
function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
