import { simulateMove } from './rules';
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

  const blockers = buildBlockers(level);
  const cycles = findDependencyCycles(level.arrows, blockers);
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
    const result = simulateMove(arrow, level.arrows.filter(({ id }) => id !== arrow.id), level.width, level.height);
    return result.ok ? [{ arrow }] : [];
  });
}

function buildBlockers(level: Level): Map<string, Set<string>> {
  const blockers = new Map(level.arrows.map(({ id }) => [id, new Set<string>()]));
  for (const arrow of level.arrows) for (const other of level.arrows) {
    if (arrow.id === other.id) continue;
    if (!simulateMove(arrow, [other], level.width, level.height).ok) blockers.get(arrow.id)!.add(other.id);
  }
  return blockers;
}

function findDependencyCycles(arrows: Arrow[], blockers: Map<string, Set<string>>): string[][] {
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
  for (const { id } of arrows) if (!indexes.has(id)) visit(id);
  return cycles;
}
