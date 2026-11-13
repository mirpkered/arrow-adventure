import round9cDefinitions from '../game/prototypes/round9c-prototypes.json';
import round9dDefinitions from '../game/prototypes/round9d-prototypes.json';
import round9hDefinition from '../game/prototypes/round9h-square-true-7.json';
import { createRun } from '../game/session';
import type { Level } from '../game/types';

export type PrototypeReviewDefinition = {
  id: string;
  name: string;
  difficulty: string;
  purpose: string;
  compositionStyle?: string;
  compositionPlan?: string;
  previewCaption?: string;
  displayLabel?: string;
  puzzle: Level;
};

export type PrototypeReviewChoice = {
  id: string;
  name: string;
  difficulty: string;
  width: number;
  height: number;
  arrowCount: number;
  compositionStyle?: string;
  displayLabel?: string;
};

const round9hReview: PrototypeReviewDefinition = {
  id: round9hDefinition.id,
  name: 'True 7×7 Square',
  displayLabel: 'Round 9H — True 7×7 Square',
  difficulty: 'Interactive QA',
  purpose: 'Test the frozen 15-arrow puzzle on a true seven-cell visible grid.',
  compositionStyle: '7×7 visible cells · 15 arrows',
  puzzle: round9hDefinition.puzzle as Level,
};

export const PROTOTYPE_REVIEWS = [...round9cDefinitions, ...round9dDefinitions, round9hReview] as PrototypeReviewDefinition[];

export const PROTOTYPE_REVIEW_CHOICES: PrototypeReviewChoice[] = PROTOTYPE_REVIEWS.map(({ id, name, difficulty, compositionStyle, displayLabel, puzzle }) => ({
  id,
  name,
  difficulty,
  width: puzzle.width,
  height: puzzle.height,
  arrowCount: puzzle.arrows.length,
  compositionStyle,
  displayLabel,
}));

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function renderPrototypeReviewSelection(): string {
  return `<main class="app-screen sub-screen prototype-review-screen">
    <header class="sub-header"><button class="icon-button" data-action="prototype-return" aria-label="Return to the QA board">‹</button><div><span class="eyebrow">QA-ONLY PLAYTEST</span><h1>Prototype Review</h1></div><span class="header-spacer"></span></header>
    <p class="prototype-review-intro">Choose a composition to play with the normal movement, collision, hearts, and touch controls. Review runs do not change Adventure Mode progress.</p>
    <section class="prototype-review-list" aria-label="Available prototypes">
      ${PROTOTYPE_REVIEW_CHOICES.map((choice, index) => `<button type="button" class="prototype-review-card" data-prototype-id="${escapeHtml(choice.id)}" aria-label="Play ${escapeHtml(choice.displayLabel ?? `Prototype ${String.fromCharCode(65 + index)} - ${choice.name}`)}, ${choice.arrowCount} arrows${choice.compositionStyle ? `, ${escapeHtml(choice.compositionStyle)}` : ''}">
        <span class="prototype-review-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
        <span class="prototype-review-copy"><b>${escapeHtml(choice.displayLabel ?? `Prototype ${String.fromCharCode(65 + index)} - ${choice.name}`)}</b><small>${choice.arrowCount} arrows · ${choice.width}×${choice.height} · ${escapeHtml(choice.difficulty)}</small>${choice.compositionStyle ? `<small class="prototype-review-style">${escapeHtml(choice.compositionStyle)}</small>` : ''}</span>
        <span class="prototype-review-chevron" aria-hidden="true">›</span>
      </button>`).join('')}
    </section>
    <button class="quiet-button prototype-review-return" type="button" data-action="prototype-return">RETURN TO QA BOARD</button>
  </main>`;
}

export function renderPrototypeReviewCompletion(letter: string, arrowCount: number): string {
  return `<main class="app-screen completion-screen"><div class="completion-symbol">✳</div><span class="eyebrow">PROTOTYPE ${escapeHtml(letter)} COMPLETE</span><h1>All clear.</h1><p>You cleared this review board. No Adventure Mode progress was changed.</p>
    <div class="completion-stat"><span>Arrows cleared</span><b>${arrowCount} / ${arrowCount}</b></div>
    <button class="primary-button" data-action="prototype-restart">REPLAY PROTOTYPE ${escapeHtml(letter)}</button>
    <button class="quiet-button" data-action="prototype-select">CHOOSE ANOTHER PROTOTYPE</button>
  </main>`;
}

export function createPrototypeReviewRun(id: string) {
  const prototype = PROTOTYPE_REVIEWS.find((entry) => entry.id === id);
  return prototype ? { prototype, run: createRun(prototype.puzzle) } : undefined;
}
