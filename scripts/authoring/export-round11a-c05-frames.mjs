import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const output = resolve(process.argv[2] ?? 'docs/previews/round-11a/c05-motion-data.json');
const server = await createServer({ configFile: './vite.config.ts', server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const [{ CURATED_LEVELS }, rules, geometry] = await Promise.all([
    server.ssrLoadModule('/src/game/catalog.ts'),
    server.ssrLoadModule('/src/game/rules.ts'),
    server.ssrLoadModule('/src/game/geometry.ts'),
  ]);
  const entry = CURATED_LEVELS[2];
  const level = entry.puzzle;
  const c05 = level.arrows.find(({ id }) => id === 'c05');
  if (!c05) throw new Error('Level 3 c05 arrow is missing.');
  const before = { ...c05, path: [...c05.path].reverse() };
  const distances = [0, 0.285, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 7, 7.3];
  const capture = (arrow) => {
    const travelDistance = rules.simulateMove(arrow, [], level.width, level.height, level.grid).travelDistance;
    return {
      exit: rules.exitDirection(arrow),
      travelDistance,
      path: arrow.path,
      frames: distances.filter((distance) => distance <= travelDistance).map((distance) => {
        const path = rules.moveArrowDistance(arrow, distance, level.grid.pathOffset);
        return { distance, path, head: geometry.arrowHeadTriangle(path, geometry.ARROW_HEAD_WIDTH, level.grid.pathOffset), tail: path[0] };
      }),
    };
  };
  const payload = {
    level: { id: entry.id, number: entry.number, title: entry.title, width: level.width, height: level.height, grid: level.grid, arrows: level.arrows.filter(({ id }) => id !== 'c05') },
    c05Before: capture(before),
    c05After: capture(c05),
    style: { bodyWidth: geometry.ARROW_STROKE_WIDTH, headWidth: geometry.ARROW_HEAD_WIDTH, tailRadius: 0.09 },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote engine-sampled c05 motion frames to ${output}`);
} finally {
  await server.close();
}
