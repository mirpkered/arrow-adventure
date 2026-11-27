import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const server = await createServer({ configFile: './vite.config.ts', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'silent' });
try {
  const [{ generateGridForest }, { orientRoutesForAcyclicDependencies }, { auditBlockerGraph }, { analyzeLevel, validateLevel }, density] = await Promise.all([
    server.ssrLoadModule('/src/game/authoring/gridForest.ts'),
    server.ssrLoadModule('/src/game/authoring/acyclicOrientation.ts'),
    server.ssrLoadModule('/src/game/stateAudit.ts'),
    server.ssrLoadModule('/src/game/rules.ts'),
    server.ssrLoadModule('/src/game/density.ts'),
  ]);
  const configurations = [
    { number: 6, width: 10, height: 10, arrowCount: 20, seed: 13006, title: 'Larger Weave', difficulty: 'hard' },
    { number: 7, width: 12, height: 12, arrowCount: 30, seed: 13007, title: 'The Deep Weave', difficulty: 'hard' },
  ];
  const generated = [];
  for (const config of configurations) {
    let draft;
    let oriented;
    for (let attempt = 0; attempt < 50 && !oriented; attempt += 1) {
      const seed = config.seed + attempt * 101;
      const candidateDraft = generateGridForest(config.width, config.height, config.arrowCount, seed);
      const candidateOrientation = orientRoutesForAcyclicDependencies(candidateDraft, seed + 9000);
      if (!candidateOrientation) continue;
      const candidatePuzzle = { ...candidateDraft, number: config.number, arrows: candidateOrientation };
      const candidateMetrics = density.measureComposition(candidatePuzzle, 1.01);
      const candidateLevelMetrics = analyzeLevel(candidatePuzzle);
      const isolated = Object.entries(candidateLevelMetrics.interleavedPairsByArrow)
        .filter(([id, degree]) => degree === 0 && candidateLevelMetrics.blockersByArrow[id] === 0);
      if (isolated.length > 0 || candidateLevelMetrics.interleavedPairs < 7
        || candidateLevelMetrics.closeSegmentContacts < config.arrowCount * 3
        || candidateLevelMetrics.initiallyRemovable > Math.ceil(config.arrowCount * 0.6)
        || candidateLevelMetrics.dependencyDepth < 2 || candidateMetrics.adjacentGridPathRatio < 0.8) continue;
      draft = candidateDraft;
      oriented = candidateOrientation;
      config.seed = seed;
    }
    if (!oriented) throw new Error(`Could not orient Level ${config.number} into a blocker DAG`);
    const puzzle = { ...draft, number: config.number, arrows: oriented };
    validateLevel(puzzle);
    const graph = auditBlockerGraph(puzzle);
    const metrics = analyzeLevel(puzzle);
    const spacing = density.measureNeighborSpacing(puzzle);
    const composition = density.measureComposition(puzzle, 1.01);
    const footprint = [[{ x: 0, y: 0 }, { x: config.width, y: 0 }, { x: config.width, y: config.height }, { x: 0, y: config.height }]];
    const densityReport = density.measureFootprintDensity({ puzzle, footprint });
    if (!graph.completeGuarantee || metrics.interleavedPairs < 7 || metrics.closeSegmentContacts < config.arrowCount * 3
      || metrics.initiallyRemovable > Math.ceil(config.arrowCount * 0.6) || metrics.dependencyDepth < 2
      || Math.max(...metrics.pathLengths) - Math.min(...metrics.pathLengths) < 2
      || Math.max(...metrics.turnCounts) - Math.min(...metrics.turnCounts) < 1
      || spacing.minimum < 0.23 || spacing.p10 < 0.32 || spacing.p90 > 3.5
      || densityReport.pathLengthInside / densityReport.pathLength < 0.9) {
      throw new Error(`Level ${config.number} candidate missed curation thresholds: ${JSON.stringify({ metrics, spacing, densityReport, graph })}`);
    }
    const entry = {
      id: `first-flight-${String(config.number).padStart(3, '0')}`,
      number: config.number,
      catalogVersion: 'first-flight-r4-large-grid',
      contentVersion: 1,
      chapterId: 'first-flight',
      title: config.title,
      difficulty: config.difficulty,
      composition: 'abstract',
      designNote: `A deterministic ${config.width}×${config.height} orthogonal grid weave partitions every visible intersection into a distinct winding arrow route (${config.arrowCount} routes, authoring seed ${config.seed}).`,
      authoringSeed: config.seed,
      footprint,
      puzzle,
    };
    generated.push(entry);
    const summary = {
      level: config.number, seed: config.seed, grid: `${config.width}x${config.height}`, arrows: config.arrowCount,
      routeLengths: metrics.pathLengths, totalRoute: metrics.pathLengths.reduce((sum, value) => sum + value, 0),
      turns: metrics.turnCounts, exits: directionCounts(oriented), occupiedIntersections: new Set(oriented.flatMap(({ path }) => path.map(({ x, y }) => `${x},${y}`))).size,
      interleavedPairs: metrics.interleavedPairs, closeContacts: metrics.closeSegmentContacts,
      blockingEdges: metrics.blockingDependencies, dependencyDepth: metrics.dependencyDepth,
      initiallyRemovable: metrics.initiallyRemovable, minSpacing: spacing.minimum, p10Spacing: spacing.p10, medianSpacing: spacing.median,
      p90Spacing: spacing.p90, adjacentCoverage: composition.adjacentGridPathRatio, largeGapRatio: densityReport.largeGapRatio,
      graph, fingerprint: sha256(JSON.stringify(puzzle)),
    };
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }
  if (process.argv.includes('--write')) {
    const path = './src/game/adventure-catalog.json';
    const catalog = JSON.parse(readFileSync(path, 'utf8'));
    const combined = [...catalog.levels.filter(({ number }) => number < 6), ...generated];
    catalog.catalogVersion = 'first-flight-r4-large-grid';
    for (const entry of combined) entry.catalogVersion = catalog.catalogVersion;
    catalog.chapter.levelIds = combined.map(({ id }) => id);
    catalog.levels = combined;
    writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
  } else {
    process.stdout.write(`CANDIDATES ${JSON.stringify(generated)}\n`);
  }
} finally {
  await server.close();
}

function directionCounts(arrows) {
  const counts = { east: 0, west: 0, north: 0, south: 0, northeast: 0, northwest: 0, southeast: 0, southwest: 0 };
  for (const arrow of arrows) {
    const previous = arrow.path.at(-2); const last = arrow.path.at(-1);
    const dx = Math.sign(last.x - previous.x); const dy = Math.sign(last.y - previous.y);
    const key = `${dx},${dy}`;
    const names = { '1,0': 'east', '-1,0': 'west', '0,-1': 'north', '0,1': 'south', '1,-1': 'northeast', '-1,-1': 'northwest', '1,1': 'southeast', '-1,1': 'southwest' };
    counts[names[key]] += 1;
  }
  return counts;
}
function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}
