import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const catalog = JSON.parse(readFileSync('./src/game/adventure-catalog.json', 'utf8'));
const entry = catalog.levels.find(({ id }) => id === 'first-flight-008');
if (!entry || entry.authoringSeed !== 17727 || entry.contentVersion !== 1) {
  throw new Error('Expected frozen Level 8 first-flight-008, content v1, seed 17727.');
}

const server = await createServer({
  configFile: './vite.config.ts',
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const [forest, orientation, audit, rules, density] = await Promise.all([
    server.ssrLoadModule('/src/game/authoring/gridForest.ts'),
    server.ssrLoadModule('/src/game/authoring/acyclicOrientation.ts'),
    server.ssrLoadModule('/src/game/stateAudit.ts'),
    server.ssrLoadModule('/src/game/rules.ts'),
    server.ssrLoadModule('/src/game/density.ts'),
  ]);

  const seed = entry.authoringSeed;
  const draft = forest.generateGridForest(14, 14, 40, seed);
  const arrows = orientation.orientRoutesForAcyclicDependencies(draft, seed + 9000);
  if (!arrows) throw new Error('The frozen Level 8 seed no longer produces a DAG orientation.');
  const reproduced = { ...draft, number: 8, arrows };
  if (JSON.stringify(reproduced) !== JSON.stringify(entry.puzzle)) {
    throw new Error('Seeded authoring no longer reproduces the frozen Level 8 routes.');
  }

  rules.validateLevel(reproduced);
  const graph = audit.auditBlockerGraph(reproduced);
  if (!graph.completeGuarantee || graph.dependencyCycles.length || graph.removalSequence.length !== 40) {
    throw new Error('Level 8 no longer has a complete acyclic blocker-graph certificate.');
  }
  let remaining = [...reproduced.arrows];
  for (const id of graph.removalSequence) {
    const moving = remaining.find((arrow) => arrow.id === id);
    if (!moving) throw new Error(`Certificate references missing arrow ${id}.`);
    const stationary = remaining.filter((arrow) => arrow.id !== id);
    if (!rules.simulateMove(moving, stationary, reproduced.width, reproduced.height, reproduced.grid).ok) {
      throw new Error(`The gameplay simulator rejects certified removal ${id}.`);
    }
    remaining = stationary;
  }
  if (remaining.length !== 0) throw new Error('Simulator replay did not clear the complete board.');

  const metrics = rules.analyzeLevel(reproduced);
  const spacing = density.measureNeighborSpacing(reproduced);
  const fingerprint = createHash('sha256').update(JSON.stringify(reproduced)).digest('hex');
  if (fingerprint !== '1dd5053b4150f4a3737c28ca3532af84c0072e97394f072f0f1b75a0cf6970d8') {
    throw new Error(`Level 8 fingerprint changed: ${fingerprint}`);
  }

  process.stdout.write(`${JSON.stringify({
    id: entry.id,
    seed,
    fingerprint,
    grid: `${reproduced.width}x${reproduced.height}`,
    arrows: reproduced.arrows.length,
    routeUnits: metrics.pathLengths.reduce((sum, value) => sum + value, 0),
    occupiedIntersections: new Set(reproduced.arrows.flatMap(({ path }) => path.map(({ x, y }) => `${x},${y}`))).size,
    adjacentGridPathRatio: density.measureComposition(reproduced, 1.01).adjacentGridPathRatio,
    minimumSpacing: spacing.minimum,
    interleavedPairs: metrics.interleavedPairs,
    blockerEdges: metrics.blockingDependencies,
    dependencyDepth: metrics.dependencyDepth,
    initialLegalMoves: graph.initialLegalMoves,
    graphCertificate: graph.completeGuarantee,
    simulatedRemovals: graph.removalSequence.length,
    exactSubsetAudit: false,
  }, null, 2)}\n`);
} finally {
  await server.close();
}
