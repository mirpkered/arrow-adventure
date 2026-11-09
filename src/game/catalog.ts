import adventureCatalog from './adventure-catalog.json';
import { measureFootprintDensity, measureNeighborSpacing, pointInFootprint } from './density';
import { isBoardGridIntersection, segmentDistance, toBoardPoint } from './geometry';
import { analyzeLevel, solveLevel, validateLevel } from './rules';
import { auditReachableStates } from './stateAudit';
import type { CuratedLevel } from './types';

export const CATALOG_VERSION = adventureCatalog.catalogVersion;
export const FIRST_FLIGHT_CHAPTER = adventureCatalog.chapter;
export const CURATED_LEVELS = adventureCatalog.levels as readonly CuratedLevel[];

const levelByNumber = new Map(CURATED_LEVELS.map((entry) => [entry.number, entry]));
const levelById = new Map(CURATED_LEVELS.map((entry) => [entry.id, entry]));

export function getCuratedLevel(number: number): CuratedLevel | undefined { return levelByNumber.get(number); }
export function getCuratedLevelById(id: string): CuratedLevel | undefined { return levelById.get(id); }
export function getNextCuratedLevel(level: CuratedLevel): CuratedLevel | undefined { return levelByNumber.get(level.number + 1); }

/** Full authoring gate. It validates exact frozen content, footprint quality, geometry, and all reachable states. */
export function validateCuratedLevels(entries: readonly CuratedLevel[] = CURATED_LEVELS): void {
  if (entries.length !== 10) throw new Error('First Flight must contain exactly ten curated levels');
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id)) throw new Error('Invalid or duplicate level ID: ' + entry.id);
    if (!Number.isInteger(entry.number) || numbers.has(entry.number)) throw new Error('Invalid or duplicate display number: ' + entry.number);
    if (entry.catalogVersion !== CATALOG_VERSION) throw new Error(`${entry.id} has the wrong catalog version`);
    if (!Number.isInteger(entry.contentVersion) || entry.contentVersion < 1) throw new Error(`${entry.id} has an invalid content version`);
    if (entry.chapterId !== FIRST_FLIGHT_CHAPTER.id) throw new Error(`${entry.id} references an unknown chapter`);
    if (!['intro', 'easy', 'easy-medium', 'medium', 'medium-hard', 'hard'].includes(entry.difficulty)) throw new Error(entry.id + ' has invalid difficulty');
    if (entry.composition !== 'abstract' && entry.composition !== 'silhouette') throw new Error(entry.id + ' has invalid composition kind');
    if (typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.designNote !== 'string' || !entry.designNote.trim()) throw new Error(entry.id + ' is missing authoring metadata');
    if (entry.puzzle.number !== entry.number) throw new Error(entry.id + ' puzzle number does not match its catalog entry');
    if (!entry.footprint.length || entry.footprint.some((polygon) => polygon.length < 3)) throw new Error(entry.id + ' has a malformed intended footprint');
    ids.add(entry.id); numbers.add(entry.number);

    validateFootprint(entry);
    validateLevel(entry.puzzle);
    const density = measureFootprintDensity(entry);
    if (density.footprintArea <= 0 || density.pathLengthInside / density.pathLength < 0.9) throw new Error(`${entry.id} paths do not occupy their authored footprint`);
    const gapLimit = entry.difficulty === 'intro' ? 0.15 : 0.1;
    if (density.largeGapRatio > gapLimit) throw new Error(`${entry.id} has ${Math.round(density.largeGapRatio * 1000) / 10}% large internal footprint gaps; limit ${gapLimit * 100}%`);
    const spacing = measureNeighborSpacing(entry.puzzle);
    if (spacing.minimum < 0.23 - 1e-8) throw new Error(`${entry.id} has distinct arrows closer than the 0.23-unit swept collision clearance`);
    if (spacing.p10 < 0.32 - 1e-8) throw new Error(`${entry.id} packs too many arrow segments below the 0.32-unit readability target`);
    if (spacing.p90 > 2.25) throw new Error(`${entry.id} has overly separated arrow neighborhoods (90th-percentile gap ${spacing.p90.toFixed(2)} units)`);

    const metrics = analyzeLevel(entry.puzzle);
    if (metrics.interleavedPairs < Math.max(2, Math.ceil(entry.puzzle.arrows.length * 0.35))
      || metrics.closeSegmentContacts < entry.puzzle.arrows.length * 5) throw new Error(entry.id + ' is too spatially separated to publish');
    const isolatedArrows = Object.entries(metrics.interleavedPairsByArrow)
      .filter(([id, degree]) => degree === 0 && metrics.blockersByArrow[id] === 0);
    if (isolatedArrows.length > 1) throw new Error(`${entry.id} has ${isolatedArrows.length} arrows disconnected from the shared weave`);
    if (metrics.dependencyDepth < 2 || metrics.initiallyRemovable === 0
      || metrics.initiallyRemovable > Math.ceil(entry.puzzle.arrows.length * 0.6)) throw new Error(entry.id + ' has weak escape dependencies');
    if (Math.max(...metrics.pathLengths) - Math.min(...metrics.pathLengths) < 2
      || Math.max(...metrics.turnCounts) - Math.min(...metrics.turnCounts) < 1) throw new Error(entry.id + ' lacks path length and turn variety');
    if (!solveLevel(entry.puzzle)) throw new Error(entry.id + ' has no complete solution');
    const audit = auditReachableStates(entry.puzzle);
    if (audit.deadlocks.length) {
      const witness = audit.deadlocks[0];
      throw new Error(`${entry.id} reaches deadlock [${witness.remainingArrowIds.join(', ')}] after [${witness.removalSequence.join(' → ') || 'no removals'}]`);
    }
    if (audit.dependencyCycles.length) throw new Error(`${entry.id} has dependency cycle [${audit.dependencyCycles[0].join(' → ')}]`);
    if (audit.terminalStates !== 1) throw new Error(`${entry.id} does not reach exactly one completed board state`);
  }
  const ordered = [...entries].sort((left, right) => left.number - right.number);
  ordered.forEach((entry, index) => { if (entry.number !== index + 1) throw new Error('Adventure levels must be numbered contiguously from Level 1'); });
  if (FIRST_FLIGHT_CHAPTER.levelIds.join('|') !== ordered.map(({ id }) => id).join('|')) throw new Error('Chapter level references do not match progression order');
}

function validateFootprint(entry: CuratedLevel): void {
  for (let polygonIndex = 0; polygonIndex < entry.footprint.length; polygonIndex += 1) {
    const polygon = entry.footprint[polygonIndex];
    for (let index = 0; index < polygon.length; index += 1) {
      const point = polygon[index];
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0
        || point.x >= entry.puzzle.width || point.y >= entry.puzzle.height
        || !isBoardGridIntersection(toBoardPoint(point))) throw new Error(`${entry.id} footprint ${polygonIndex} vertex ${index} is invalid or off-grid`);
    }
    const area = polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
    if (Math.abs(area) < 1e-8) throw new Error(`${entry.id} footprint ${polygonIndex} has no area`);
    for (let a = 0; a < polygon.length; a += 1) for (let b = a + 1; b < polygon.length; b += 1) {
      if (b === a + 1 || (a === 0 && b === polygon.length - 1)) continue;
      const left = { a: toBoardPoint(polygon[a]), b: toBoardPoint(polygon[(a + 1) % polygon.length]) };
      const right = { a: toBoardPoint(polygon[b]), b: toBoardPoint(polygon[(b + 1) % polygon.length]) };
      if (segmentDistance(left, right) <= 1e-8) throw new Error(`${entry.id} footprint ${polygonIndex} self-intersects at edges ${a} and ${b}`);
    }
  }
  for (const arrow of entry.puzzle.arrows) for (const point of arrow.path) {
    if (!pointInFootprint(point, entry.footprint)) throw new Error(`${entry.id} arrow ${arrow.id} leaves the intended footprint at (${point.x}, ${point.y})`);
  }
}

export function catalogContentSignature(entry: CuratedLevel): string {
  return JSON.stringify({ id: entry.id, catalogVersion: entry.catalogVersion, contentVersion: entry.contentVersion, puzzle: entry.puzzle });
}
