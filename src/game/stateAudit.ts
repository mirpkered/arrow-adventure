import { buildExitBlockers, simulateMove } from './rules';
import type { Arrow, Level } from './types';

export const MAX_EXACT_AUDIT_ARROWS = 20;
export const MAX_EXACT_AUDIT_STATES = 1 << MAX_EXACT_AUDIT_ARROWS;

export type DeadlockWitness = { remainingArrowIds: string[]; removalSequence: string[] };
export type StateSpaceAudit = {
  exact: true;
  reachableStates: number;
  legalTransitions: number;
  terminalStates: number;
  initialLegalMoves: string[];
  deadlocks: DeadlockWitness[];
  dependencyCycles: string[][];
};

export type BlockerGraphAudit = {
  method: 'static-blocker-dag';
  stateEnumeration: false;
  completeGuarantee: boolean;
  arrowCount: number;
  blockerEdges: number;
  initialLegalMoves: string[];
  removalSequence: string[];
  dependencyCycles: string[][];
  deadlockWitness?: DeadlockWitness;
};

/**
 * Certifies all-state solvability for the current static, removal-only rules.
 * Pairwise edges are built with the same swept-body simulator used by play.
 * In this ruleset, a move is legal against a set of stationary arrows iff it
 * is legal against every arrow individually (collision is the union of static
 * obstacles). Removing an arrow only removes obstacles. Therefore an acyclic
 * blocker graph remains acyclic in every remaining subset; every nonempty
 * induced DAG has a sink (an arrow with no remaining blockers), and every
 * legal move leaves another induced DAG. A cycle yields a reachable sinkless
 * residual after repeatedly removing legal sinks. This proof is specific to
 * static obstacles and must not be reused for switches, gates, portals, or
 * other state-changing mechanics.
 */
export function auditBlockerGraph(level: Level): BlockerGraphAudit {
  const blockers = buildExitBlockers(level);
  const audit = analyzeBlockerDependencies(level.arrows.map(({ id }) => id), blockers);
  const remaining = new Set(level.arrows.map(({ id }) => id));
  for (const id of audit.removalSequence) {
    const arrow = level.arrows.find((candidate) => candidate.id === id)!;
    const result = simulateMove(arrow, level.arrows.filter((candidate) => candidate.id !== id && remaining.has(candidate.id)), level.width, level.height, level.grid);
    if (!result.ok) throw new Error(`Blocker graph disagrees with gameplay simulator for ${id}; blocked by ${result.blockedBy}`);
    remaining.delete(id);
  }
  return audit;
}

/** Pure graph certificate helper, also used to regression-test cycle witnesses. */
export function analyzeBlockerDependencies(arrowIds: string[], blockers: Map<string, Set<string>>): BlockerGraphAudit {
  const cycles = findDependencyCycles(arrowIds, blockers);
  const edgeCount = [...blockers.values()].reduce((sum, set) => sum + set.size, 0);
  const remaining = new Set(arrowIds);
  const initialLegalMoves = arrowIds.filter((id) => [...(blockers.get(id) ?? [])].every((blocker) => !remaining.has(blocker)));
  const removalSequence: string[] = [];
  while (remaining.size > 0) {
    const legal = arrowIds.find((id) => remaining.has(id)
      && [...(blockers.get(id) ?? [])].every((blocker) => !remaining.has(blocker)));
    if (!legal) {
      return {
        method: 'static-blocker-dag', stateEnumeration: false, completeGuarantee: false,
        arrowCount: arrowIds.length, blockerEdges: edgeCount, initialLegalMoves,
        removalSequence, dependencyCycles: cycles,
        deadlockWitness: { remainingArrowIds: arrowIds.filter((id) => remaining.has(id)), removalSequence },
      };
    }
    removalSequence.push(legal);
    remaining.delete(legal);
  }
  return {
    method: 'static-blocker-dag', stateEnumeration: false, completeGuarantee: cycles.length === 0,
    arrowCount: arrowIds.length, blockerEdges: edgeCount, initialLegalMoves,
    removalSequence, dependencyCycles: cycles,
  };
}

/**
 * Exhaustively visits every successful-removal subset, bounded to 20 arrows.
 * Pairwise blocker edges are computed by the real full-body simulator. This is
 * equivalent to a multi-arrow state check because all non-selected arrows are
 * stationary: a path is legal iff it escapes every remaining arrow separately.
 */
export function auditReachableStates(level: Level): StateSpaceAudit {
  const count = level.arrows.length;
  if (count > MAX_EXACT_AUDIT_ARROWS) {
    throw new Error(`Exact state audit is bounded to ${MAX_EXACT_AUDIT_ARROWS} arrows; received ${count}`);
  }

  const blockers = buildExitBlockers(level);
  const cycles = findDependencyCycles(level.arrows.map(({ id }) => id), blockers);
  const fullMask = (1 << count) - 1;
  const pending: Array<{ mask: number; sequence: string[] }> = [{ mask: fullMask, sequence: [] }];
  const seen = new Set<number>();
  const deadlocks: DeadlockWitness[] = [];
  const initialLegalMoves: string[] = [];
  let legalTransitions = 0;
  let terminalStates = 0;

  while (pending.length > 0) {
    const state = pending.pop()!;
    if (seen.has(state.mask)) continue;
    if (seen.size >= MAX_EXACT_AUDIT_STATES) throw new Error('Exact state audit exceeded its configured state cap');
    seen.add(state.mask);

    if (state.mask === 0) { terminalStates += 1; continue; }
    const legal = level.arrows.filter((arrow, index) => (state.mask & (1 << index)) !== 0
      && ![...blockers.get(arrow.id)!].some((blockedBy) => {
        const blockedIndex = level.arrows.findIndex((candidate) => candidate.id === blockedBy);
        return (state.mask & (1 << blockedIndex)) !== 0;
      }));
    if (state.sequence.length === 0) initialLegalMoves.push(...legal.map(({ id }) => id));

    if (legal.length === 0) {
      deadlocks.push({
        remainingArrowIds: level.arrows.filter((_, index) => (state.mask & (1 << index)) !== 0).map(({ id }) => id),
        removalSequence: state.sequence,
      });
      continue;
    }

    for (const arrow of legal) {
      legalTransitions += 1;
      const index = level.arrows.findIndex((candidate) => candidate.id === arrow.id);
      pending.push({ mask: state.mask & ~(1 << index), sequence: [...state.sequence, arrow.id] });
    }
  }

  return { exact: true, reachableStates: seen.size, legalTransitions, terminalStates, initialLegalMoves, deadlocks, dependencyCycles: cycles };
}

/** Returns immediate safe moves using the same movement simulator as play and the solver. */
export function legalMoves(level: Level): Array<{ arrow: Arrow; blockedBy?: string }> {
  return level.arrows.flatMap((arrow) => {
    const result = simulateMove(arrow, level.arrows.filter(({ id }) => id !== arrow.id), level.width, level.height, level.grid);
    return result.ok ? [{ arrow }] : [];
  });
}

function findDependencyCycles(arrowIds: string[], blockers: Map<string, Set<string>>): string[][] {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  const visit = (id: string): void => {
    indexes.set(id, nextIndex); lowLinks.set(id, nextIndex); nextIndex += 1;
    stack.push(id); onStack.add(id);
    for (const blocker of blockers.get(id) ?? []) {
      if (!indexes.has(blocker)) {
        visit(blocker);
        lowLinks.set(id, Math.min(lowLinks.get(id)!, lowLinks.get(blocker)!));
      } else if (onStack.has(blocker)) lowLinks.set(id, Math.min(lowLinks.get(id)!, indexes.get(blocker)!));
    }
    if (lowLinks.get(id) !== indexes.get(id)) return;
    const component: string[] = [];
    let member: string;
    do { member = stack.pop()!; onStack.delete(member); component.push(member); } while (member !== id);
    if (component.length > 1 || blockers.get(id)?.has(id)) cycles.push(component.sort());
  };
  for (const id of arrowIds) if (!indexes.has(id)) visit(id);
  return cycles;
}
