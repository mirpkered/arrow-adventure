import { LEVELS } from './game/levels';
import { markLevelComplete, loadProgress, saveProgress, type StorageLike } from './game/progress';
import { createRun, loseHeart } from './game/session';
import { completeLevel, simulateMove } from './game/rules';
import type { Arrow, Level, Point } from './game/types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const storage = window.localStorage as StorageLike;
let progress = loadProgress(storage);
let level: Level | null = null;
let arrows: Arrow[] = [];
let hearts = 3;
let busy = false;
let notice = '';
let view: 'title' | 'game' | 'complete' | 'out' = 'title';
let animatingId: string | null = null;
let shakeId: string | null = null;
let openLevels = false;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function startLevel(number: number): void {
  level = LEVELS[number - 1];
  if (!level || number > progress.highestUnlocked) return;
  const run = createRun(level);
  arrows = run.arrows;
  hearts = run.hearts;
  notice = '';
  busy = false;
  animatingId = null;
  view = 'game';
  openLevels = false;
  render();
}

function pointString(points: Point[]): string { return points.map(({ x, y }) => `${x + 0.5},${y + 0.5}`).join(' '); }

function arrowMarkup(arrow: Arrow): string {
  const last = arrow.path.at(-1)!;
  const classes = [animatingId === arrow.id ? 'arrow moving' : 'arrow', shakeId === arrow.id ? 'shaking' : ''].join(' ');
  const tail = arrow.path[0];
  return `<g class="${classes}" data-arrow="${escapeHtml(arrow.id)}" role="button" tabindex="0" aria-label="Arrow facing right, ${arrow.path.length} segments" style="--arrow-color:${arrow.color}">
    <polyline class="arrow-line" points="${pointString(arrow.path)}" />
    <circle class="tail-dot" cx="${tail.x + 0.5}" cy="${tail.y + 0.5}" r=".13" />
    <path class="arrow-head" d="M ${last.x + 1.02} ${last.y + 0.5} L ${last.x + 0.57} ${last.y + 0.19} L ${last.x + 0.57} ${last.y + 0.81} Z" />
    <path class="hit-area" d="M ${pointString(arrow.path).replaceAll(' ', ' L ')}" />
  </g>`;
}

function boardMarkup(): string {
  if (!level) return '';
  const grid = [];
  for (let x = 1; x < level.width; x += 1) grid.push(`<path d="M ${x} 0 V ${level.height}" />`);
  for (let y = 1; y < level.height; y += 1) grid.push(`<path d="M 0 ${y} H ${level.width}" />`);
  return `<div class="board-wrap"><svg class="board" width="100%" height="100%" viewBox="-0.22 -0.22 ${level.width + 0.44} ${level.height + 0.44}" role="group" aria-label="Puzzle board, ${arrows.length} arrows remaining">
    <rect class="board-bg" x="-.2" y="-.2" width="${level.width + 0.4}" height="${level.height + 0.4}" rx=".42" />
    <g class="grid-lines">${grid.join('')}</g>
    ${arrows.map(arrowMarkup).join('')}
  </svg></div>`;
}

function levelPicker(): string {
  return `<div class="level-picker" aria-label="Choose a level">${LEVELS.map((item) => {
    const unlocked = item.number <= progress.highestUnlocked;
    const done = progress.completed.includes(item.number);
    return `<button class="level-chip ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}" data-level="${item.number}" ${unlocked ? '' : 'disabled'}>${unlocked ? item.number : '·'}${done ? '<span>✓</span>' : ''}</button>`;
  }).join('')}</div>`;
}

function render(): void {
  if (view === 'title') {
    const resume = Math.min(progress.highestUnlocked, 10);
    app.innerHTML = `<main class="screen title-screen">
      <div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>MIRPWORKS <b>ADVENTURE</b></span></div>
      <section class="title-content">
        <div class="eyebrow">A LITTLE SPACE TO THINK</div>
        <h1>Arrow<br /><em>Adventure</em></h1>
        <p class="intro">Find a clear path. Let every arrow go.</p>
        <div class="title-art" aria-hidden="true"><span class="art-arrow art-one">↗</span><span class="art-arrow art-two">→</span><span class="art-arrow art-three">↘</span><span class="art-spark">✳</span></div>
        <button class="primary-button" data-action="play">${progress.completed.length ? `Continue · Level ${resume}` : 'Start the adventure'} <span>→</span></button>
        <p class="quiet-note">No rush. Take your time.</p>
      </section>
      <footer class="title-footer">A puzzle adventure by <strong>Mirpworks</strong></footer>
    </main>`;
    return;
  }

  if (view === 'complete') {
    const next = level!.number < 10;
    app.innerHTML = `<main class="screen finish-screen"><div class="brand compact"><span class="brand-mark"><i></i><i></i><i></i></span><span>MIRPWORKS <b>ADVENTURE</b></span></div>
      <section class="finish-card"><div class="finish-spark">✳</div><div class="eyebrow">LEVEL ${level!.number} COMPLETE</div><h1>All clear.</h1><p>Every arrow found its way out.</p>
      <div class="finish-stats"><span>Arrows cleared</span><b>${level!.arrows.length} / ${level!.arrows.length}</b></div>
      <button class="primary-button" data-action="${next ? 'next' : 'home'}">${next ? 'Next level' : 'Back to adventure'} <span>→</span></button>
      <button class="text-button" data-action="home">Choose a level</button></section></main>`;
    return;
  }

  const noHearts = view === 'out';
  app.innerHTML = `<main class="screen game-screen">
    <header class="game-header"><button class="icon-button home-button" data-action="home" aria-label="Back to title">⌂</button><div class="brand compact"><span class="brand-mark"><i></i><i></i><i></i></span><span>MIRPWORKS <b>ADVENTURE</b></span></div><button class="icon-button restart-button" data-action="restart" aria-label="Restart level">↻</button></header>
    <div class="level-row"><button class="level-title" data-action="levels">LEVEL <strong>${level!.number}</strong><span class="chevron">⌄</span></button><div class="hearts" aria-label="${hearts} of 3 hearts remaining">${[0, 1, 2].map((index) => `<span class="heart ${index < hearts ? 'live' : 'lost'}">♥</span>`).join('')}</div></div>
    ${openLevels ? levelPicker() : ''}
    <div class="prompt-row"><span class="prompt-icon">↗</span><span>${notice || 'Tap an arrow to send it on its way.'}</span></div>
    ${boardMarkup()}
    <div class="game-bottom"><span class="remaining">${arrows.length} <small>${arrows.length === 1 ? 'arrow' : 'arrows'} left</small></span><span class="bottom-hint">Clear the path to the edge</span></div>
    ${noHearts ? `<div class="scrim"><section class="modal-card"><div class="modal-icon">↻</div><div class="eyebrow">TAKE ANOTHER LOOK</div><h2>Out of hearts.</h2><p>Try the level again and watch for arrows that need a clear exit.</p><button class="primary-button" data-action="restart">Restart level <span>↻</span></button><button class="text-button" data-action="home">Back to title</button></section></div>` : ''}
  </main>`;
}

async function attemptMove(id: string): Promise<void> {
  if (busy || view !== 'game' || !level) return;
  const arrow = arrows.find((item) => item.id === id);
  if (!arrow) return;
  const result = simulateMove(arrow, arrows.filter((item) => item.id !== id), level.width);
  if (!result.ok) {
    hearts = loseHeart(hearts);
    notice = `That arrow is blocked by another one.`;
    shakeId = id;
    if (hearts <= 0) view = 'out';
    render();
    window.setTimeout(() => { shakeId = null; }, 450);
    return;
  }

  busy = true;
  animatingId = id;
  notice = '';
  for (const frame of result.frames) {
    const live = arrows.find((item) => item.id === id);
    if (!live) break;
    live.path = frame;
    render();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 42));
  }
  arrows = arrows.filter((item) => item.id !== id);
  animatingId = null;
  busy = false;
  if (completeLevel(arrows)) {
    progress = markLevelComplete(progress, level.number);
    saveProgress(storage, progress);
    view = 'complete';
  }
  render();
}

app.addEventListener('click', (event) => {
  const target = event.target as Element;
  const button = target.closest<HTMLElement>('[data-action], [data-level]');
  if (button?.dataset.action) {
    const action = button.dataset.action;
    if (action === 'play') startLevel(Math.min(progress.highestUnlocked, 10));
    if (action === 'restart' && level) startLevel(level.number);
    if (action === 'home') { view = 'title'; openLevels = false; render(); }
    if (action === 'next' && level) startLevel(Math.min(10, level.number + 1));
    if (action === 'levels') { openLevels = !openLevels; render(); }
    return;
  }
  if (button?.dataset.level) { startLevel(Number(button.dataset.level)); return; }
  const arrow = target.closest<SVGGElement>('[data-arrow]');
  if (arrow?.dataset.arrow) void attemptMove(arrow.dataset.arrow);
});

app.addEventListener('keydown', (event) => {
  const target = event.target as Element;
  const arrow = target.closest<SVGGElement>('[data-arrow]');
  if (arrow && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    if (arrow.dataset.arrow) void attemptMove(arrow.dataset.arrow);
  }
});

render();
