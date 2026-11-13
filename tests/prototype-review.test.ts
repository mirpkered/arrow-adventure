import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS } from '../src/game/catalog';
import { auditReachableStates } from '../src/game/stateAudit';
import { solveLevel, validateLevel } from '../src/game/rules';
import { createPrototypeReviewRun, PROTOTYPE_REVIEWS, renderPrototypeReviewCompletion, renderPrototypeReviewSelection } from '../src/qa/prototypeReview';
import { shouldPersistProgress } from '../src/game/session';

const mainSource = readFileSync(fileURLToPath(new URL('../src/main.ts', import.meta.url)), 'utf8');
const qaPanelSource = readFileSync(fileURLToPath(new URL('../src/qa/qaPanel.ts', import.meta.url)), 'utf8');
const prototypeModuleSource = readFileSync(fileURLToPath(new URL('../src/qa/prototypeReview.ts', import.meta.url)), 'utf8');
const styleSource = readFileSync(fileURLToPath(new URL('../src/style.css', import.meta.url)), 'utf8');

describe('isolated prototype review mode', () => {
  it('preserves prototypes A–H and appends the named Round 9H true-grid board outside Adventure Mode', () => {
    expect(PROTOTYPE_REVIEWS.slice(0, 3).map(({ id, name }) => [id, name])).toEqual([
      ['round9c-compact-weave', 'Compact Abstract Weave'],
      ['round9c-heart', 'Heart in the Weave'],
      ['round9c-advanced-weave', 'Advanced Abstract Weave'],
    ]);
    expect(PROTOTYPE_REVIEWS.slice(3, 8).map(({ id, name, compositionStyle }) => [id, name, compositionStyle])).toEqual([
      ['round9d-micro-arrow-field', 'Micro-Arrow Field', 'Micro-arrow grid'],
      ['round9d-dense-interwoven-maze', 'Dense Interwoven Maze', 'Dense interwoven maze'],
      ['round9d-tree-silhouette', 'Tree Silhouette', 'Recognizable silhouette'],
      ['round9d-large-mixed-weave', 'Large Mixed-Length Weave', 'Large mixed-length weave'],
      ['round9d-framed-composition', 'Framed Composition', 'Framed negative space'],
    ]);
    expect(PROTOTYPE_REVIEWS[8]).toMatchObject({
      id: 'prototype-square-true-7', name: 'True 7×7 Square', displayLabel: 'Round 9H — True 7×7 Square',
      puzzle: { width: 7, height: 7, arrows: expect.arrayContaining([expect.any(Object)]) },
    });
    expect(PROTOTYPE_REVIEWS[8].puzzle.arrows).toHaveLength(15);
    expect(PROTOTYPE_REVIEWS[8].puzzle.grid).toEqual({
      spacing: 1, origin: { x: 0, y: 0 }, pathOffset: 0, includeOuterBoundary: true,
    });
    expect(CURATED_LEVELS).toHaveLength(10);
    expect(CURATED_LEVELS.some(({ id }) => id.startsWith('round9c-') || id.startsWith('round9d-') || id === 'prototype-square-true-7')).toBe(false);
    const selection = renderPrototypeReviewSelection();
    expect((selection.match(/data-prototype-id=/g) ?? [])).toHaveLength(9);
    for (const { id, name } of PROTOTYPE_REVIEWS) {
      expect(selection).toContain(id);
      expect(selection).toContain(name);
    }
    expect(selection).toContain('Round 9H — True 7×7 Square');
    expect(renderPrototypeReviewCompletion('A', 6)).toContain('REPLAY PROTOTYPE A');
    expect(renderPrototypeReviewCompletion('A', 6)).toContain('CHOOSE ANOTHER PROTOTYPE');
  });

  it('uses the real gameplay definitions and validates all nine playable prototypes', () => {
    for (const { puzzle } of PROTOTYPE_REVIEWS) {
      expect(() => validateLevel(puzzle)).not.toThrow();
      expect(solveLevel(puzzle)).not.toBeNull();
      const audit = auditReachableStates(puzzle);
      expect(audit.exact).toBe(true);
      expect(audit.deadlocks).toEqual([]);
      expect(audit.dependencyCycles).toEqual([]);
    }
  });

  it('creates fresh three-heart runs for repeatable restarts without mutating prototype data', () => {
    const prototype = PROTOTYPE_REVIEWS[0];
    const original = JSON.stringify(prototype.puzzle);
    const first = createPrototypeReviewRun(prototype.id)!;
    first.run.arrows.pop();
    first.run.hearts = 1;
    const restarted = createPrototypeReviewRun(prototype.id)!;
    expect(restarted.run.hearts).toBe(3);
    expect(restarted.run.arrows).toHaveLength(prototype.puzzle.arrows.length);
    expect(restarted.run.arrows).not.toBe(first.run.arrows);
    expect(JSON.stringify(prototype.puzzle)).toBe(original);
    expect(createPrototypeReviewRun('missing')).toBeUndefined();
    const round9h = PROTOTYPE_REVIEWS[8];
    const round9hRun = createPrototypeReviewRun(round9h.id)!;
    expect(round9hRun.run.hearts).toBe(3);
    expect(round9hRun.run.arrows).toHaveLength(15);
  });

  it('keeps prototype runs out of Adventure Mode progress saves', () => {
    expect(shouldPersistProgress('adventure', false)).toBe(true);
    expect(shouldPersistProgress('adventure', true)).toBe(false);
    expect(shouldPersistProgress('prototype-review', false)).toBe(false);
    expect(mainSource).toContain("shouldPersistProgress(activePrototype ? 'prototype-review' : 'adventure', busy)");
    expect(mainSource).toContain("if (QA_MODE) {");
    expect(mainSource).toContain("import('./qa/prototypeReview')");
  });

  it('provides direct selection, in-mode restart, and a return path without using normal level completion', () => {
    expect(mainSource).toContain("screen = 'prototype-select'");
    expect(prototypeModuleSource).toContain('data-prototype-id=');
    expect(mainSource).toContain("if (action === 'prototype-restart' && activePrototype) startPrototypeReview(activePrototype.id)");
    expect(mainSource).toContain("if (action === 'prototype-select' && activePrototype) returnToPrototypeSelection()");
    expect(mainSource).toContain("if (action === 'prototype-return' && screen === 'prototype-select') leavePrototypeReview()");
    expect(mainSource).toContain('if (!activePrototype) {');
    expect(qaPanelSource).toContain('data-prototype-review');
    expect(styleSource).toContain('.prototype-review-card');
  });
});
