import { simulateMove, validateArrow } from '../rules';
import type { Arrow, Level } from '../types';

/**
 * Offline authoring aid: chooses each route's forward/reverse orientation so
 * that static obstacle dependencies form a DAG. It never changes geometry.
 * The checked-in catalog remains frozen; runtime play does not call this.
 */
export function orientRoutesForAcyclicDependencies(level: Level, seed: number, initialMoveFraction = 0.45): Arrow[] | undefined {
  const random = seededRandom(seed);
  const variants = level.arrows.map((arrow) => [arrow, { ...arrow, path: [...arrow.path].reverse() }] as const);
  const blockers = variants.map((pair, index) => pair.map((variant) => {
    try { validateArrow(variant, level.width, level.height, level.number, level.grid); } catch { return undefined; }
    return new Set(level.arrows.flatMap((other, otherIndex) => {
      if (index === otherIndex) return [];
      return simulateMove(variant, [other], level.width, level.height, level.grid).ok ? [] : [other.id];
    }));
  }));

  const idealInitial = Math.max(1, Math.floor(level.arrows.length * initialMoveFraction));
  const maximumInitial = Math.max(idealInitial, Math.ceil(level.arrows.length * 0.6));
  const maximumSearchNodes = 25000;
  let searchNodes = 0;
  const search = (assigned: Map<number, Arrow>, removed: Set<string>, initialCount: number): Map<number, Arrow> | undefined => {
    if (assigned.size === level.arrows.length) return assigned;
    if (++searchNodes > maximumSearchNodes) return undefined;
    const eligible = variants.flatMap((pair, index) => assigned.has(index) ? [] : pair
      .map((arrow, orientation) => ({ index, arrow, blockers: blockers[index][orientation] }))
      .filter((choice): choice is { index: number; arrow: Arrow; blockers: Set<string> } => Boolean(choice.blockers))
      .filter(({ blockers: dependencies }) => [...dependencies].every((id) => removed.has(id)))
      .filter(({ blockers: dependencies }) => dependencies.size > 0 || initialCount < maximumInitial)
      .map((choice) => ({ ...choice, rank: random() })));
    // Prefer to establish a useful set of opening moves, then favor genuine
    // dependencies on already cleared routes. Seeded ties keep the choice stable.
    eligible.sort((left, right) => {
      const leftZero = left.blockers.size === 0; const rightZero = right.blockers.size === 0;
      if (initialCount < idealInitial && leftZero !== rightZero) return leftZero ? -1 : 1;
      if (initialCount >= idealInitial && leftZero !== rightZero) return leftZero ? 1 : -1;
      return right.blockers.size - left.blockers.size || right.rank - left.rank;
    });
    for (const candidate of eligible) {
      const nextAssigned = new Map(assigned); nextAssigned.set(candidate.index, candidate.arrow);
      const nextRemoved = new Set(removed); nextRemoved.add(candidate.arrow.id);
      const result = search(nextAssigned, nextRemoved, initialCount + Number(candidate.blockers.size === 0));
      if (result) return result;
      if (searchNodes > maximumSearchNodes) break;
    }
    return undefined;
  };
  const result = search(new Map(), new Set(), 0);
  return result ? level.arrows.map((_, index) => result.get(index)!) : undefined;
}

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
