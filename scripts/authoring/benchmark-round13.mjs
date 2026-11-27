import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

const server = await createServer({ configFile: './vite.config.ts', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'silent' });
try {
  const [{ CURATED_LEVELS }, rules, audit] = await Promise.all([
    server.ssrLoadModule('/src/game/catalog.ts'),
    server.ssrLoadModule('/src/game/rules.ts'),
    server.ssrLoadModule('/src/game/stateAudit.ts'),
  ]);
  const levels = CURATED_LEVELS.map(({ puzzle }) => puzzle);
  const results = [];
  const processStart = process.memoryUsage();
  const totalStart = performance.now();
  for (const level of levels) {
    const graphStart = performance.now();
    const blockers = rules.buildExitBlockers(level);
    const graphMs = performance.now() - graphStart;

    const certificateStart = performance.now();
    const certificate = audit.auditBlockerGraph(level);
    const certificateMs = performance.now() - certificateStart;

    let exact = null;
    let exactMs = null;
    if (level.arrows.length <= audit.MAX_EXACT_AUDIT_ARROWS) {
      const exactStart = performance.now();
      exact = audit.auditReachableStates(level);
      exactMs = performance.now() - exactStart;
    }

    const solverStart = performance.now();
    const solution = rules.solveLevel(level);
    const solverMs = performance.now() - solverStart;

    const sample = level.arrows[Math.floor(level.arrows.length / 2)];
    const others = level.arrows.filter(({ id }) => id !== sample.id);
    const tapStart = performance.now();
    for (let repeat = 0; repeat < 100; repeat += 1) rules.simulateMove(sample, others, level.width, level.height, level.grid);
    const hundredMoveChecksMs = performance.now() - tapStart;

    results.push({
      level: level.number,
      grid: `${level.width}x${level.height}`,
      arrows: level.arrows.length,
      blockerEdges: [...blockers.values()].reduce((sum, edges) => sum + edges.size, 0),
      graphConstructionMs: round(graphMs),
      graphCertificateMs: round(certificateMs),
      exactAuditMs: exactMs === null ? null : round(exactMs),
      exactReachableStates: exact?.reachableStates ?? null,
      exactTransitions: exact?.legalTransitions ?? null,
      solverMs: round(solverMs),
      solutionLength: solution?.length ?? null,
      hundredFullBoardMoveChecksMs: round(hundredMoveChecksMs),
      proofMethod: exact ? 'exact-state-enumeration' : certificate.method,
      proofComplete: exact ? exact.deadlocks.length === 0 && exact.dependencyCycles.length === 0 : certificate.completeGuarantee,
    });
  }
  process.stdout.write(`${JSON.stringify({
    totalValidationMs: round(performance.now() - totalStart),
    memoryBeforeBytes: processStart.rss,
    memoryAfterBytes: process.memoryUsage().rss,
    note: 'Single-process Windows authoring benchmark; graph/cache work is cold per distinct frozen level, exact audit is exhaustive when within the 20-arrow limit.',
    levels: results,
  }, null, 2)}\n`);
} finally {
  await server.close();
}

function round(value) { return Math.round(value * 100) / 100; }
