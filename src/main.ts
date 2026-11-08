import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel } from './game/catalog';
import { advanceSession, createRun, createSession, loseHeart, type PrototypeSession } from './game/session';
import { createActionGate } from './game/input';
import { completeLevel, directionName, exitDirection, moveArrowDistance, nearestArrowAt, simulateMove } from './game/rules';
import { ARROW_STROKE_WIDTH, arrowHeadTriangle } from './game/geometry';
import type { Arrow, Level, Point } from './game/types';
import type { DiagnosticFlags } from './qa/qaPanel';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const QA_MODE = import.meta.env.DEV || import.meta.env.VITE_QA_MODE === 'true';
let session: PrototypeSession = createSession();
let catalogEntry = getCuratedLevel(session.levelNumber)!;
let level: Level = catalogEntry.puzzle;
let arrows: Arrow[] = [];
let hearts = 3;
let busy = false;
let notice = '';
let view: 'game' | 'complete' | 'out' = 'game';
let animatingId: string | null = null;
let shakeId: string | null = null;
let animationToken = 0;
const actionGate = createActionGate();
let speedMultiplier = 2;
let strokeWidth = ARROW_STROKE_WIDTH;
let diagnostics: DiagnosticFlags = { ids: false, ownership: false, hitTargets: false, geometry: false };
let qaPanel: { open: () => void; bind: (target: HTMLElement, open: () => void) => () => void } | undefined;
let unbindHold: (() => void) | undefined;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function startLevel(number: number): void {
  animationToken += 1;
  actionGate.reset();
  const entry = getCuratedLevel(number);
  if (!entry) return;
  session = { levelNumber: entry.number };
  catalogEntry = entry;
  level = entry.puzzle;
  const run = createRun(level);
  arrows = run.arrows;
  hearts = run.hearts;
  notice = '';
  busy = false;
  animatingId = null;
  view = 'game';
  render();
}

function pointString(points: Point[]): string { return points.map(({ x, y }) => `${x + 0.5},${y + 0.5}`).join(' '); }
function arrowColor(id: string): string { let hash = 0; for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return `hsl(${hash % 360} 65% 48%)`; }

function arrowMarkup(arrow: Arrow): string {
  const direction = exitDirection(arrow);
  const [tip, wingA, wingB] = arrowHeadTriangle(arrow.path, strokeWidth);
  const classes = [animatingId === arrow.id ? 'arrow moving' : 'arrow', shakeId === arrow.id ? 'shaking' : ''].join(' ');
  const tail = arrow.path[0];
  const points = pointString(arrow.path);
  const middle = arrow.path[Math.floor(arrow.path.length / 2)];
  const color = diagnostics.ownership ? arrowColor(arrow.id) : '#30383d';
  return `<g class="${classes}" data-arrow="${escapeHtml(arrow.id)}" role="button" tabindex="0" aria-label="Arrow facing ${directionName(direction)}, ${arrow.path.length - 1} segments" style="--arrow-qa-color:${color}">
    ${diagnostics.hitTargets ? `<polyline class="debug-hit" points="${points}" />` : ''}
    <polyline class="arrow-line" points="${points}" />
    <circle class="tail-dot" cx="${tail.x + 0.5}" cy="${tail.y + 0.5}" r=".09" />
    <path class="arrow-head" d="M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z" />
    ${diagnostics.ids ? `<text class="debug-id" x="${middle.x + 0.5}" y="${middle.y + 0.5}">${escapeHtml(arrow.id)}</text>` : ''}
  </g>`;
}

function boardMarkup(): string {
  const grid: string[] = [];
  if (diagnostics.geometry) {
    for (let x = 1; x < level.width; x += 1) grid.push(`<path d="M ${x} 0 V ${level.height}" />`);
    for (let y = 1; y < level.height; y += 1) grid.push(`<path d="M 0 ${y} H ${level.width}" />`);
  }
  return `<div class="board-wrap"><svg class="board" width="100%" height="100%" viewBox="-0.22 -0.22 ${level.width + 0.44} ${level.height + 0.44}" role="group" aria-label="Puzzle board, ${arrows.length} arrows remaining">
    <rect class="board-bg" x="-.2" y="-.2" width="${level.width + 0.4}" height="${level.height + 0.4}" rx=".3" />
    <g class="grid-lines">${grid.join('')}</g>
    ${arrows.map(arrowMarkup).join('')}
  </svg></div>`;
}

function bindQATrigger(): void {
  unbindHold?.();
  if (!QA_MODE || !qaPanel) return;
  const trigger = app.querySelector<HTMLElement>('#level-hold');
  if (trigger) unbindHold = qaPanel.bind(trigger, qaPanel.open);
}

function render(): void {
  if (view === 'complete') {
    const next = getNextCuratedLevel(catalogEntry);
    app.innerHTML = `<main class="screen finish-screen"><section class="finish-card"><div class="finish-spark">✳</div><div class="eyebrow">${next ? `LEVEL ${catalogEntry.number} COMPLETE` : 'PROTOTYPE COMPLETE'}</div><h1>${next ? 'All clear.' : 'Nicely untangled.'}</h1><p>${next ? 'Every arrow found its way out.' : 'You cleared the current six-level QA set.'}</p>
      <div class="finish-stats"><span>Arrows cleared</span><b>${level.arrows.length} / ${level.arrows.length}</b></div>
      <button class="primary-button" data-action="${next ? 'next' : 'replay'}">${next ? `Next · Level ${next.number}` : 'Replay Level 1'} <span>→</span></button></section></main>`;
    bindQATrigger(); return;
  }

  const noHearts = view === 'out';
  app.innerHTML = `<main class="screen game-screen">
    <header class="game-header">
      <button id="level-hold" class="level-trigger" aria-label="${QA_MODE ? `Level ${catalogEntry.number}. In QA, hold for two seconds to open settings` : `Level ${catalogEntry.number}`}" title="${QA_MODE ? 'Hold for QA settings' : `Level ${catalogEntry.number}`}" type="button"><span class="level-kicker">LEVEL</span><strong>${catalogEntry.number}</strong><span class="level-name">${escapeHtml(catalogEntry.title)}</span></button>
      <div class="hearts" aria-label="${hearts} of 3 hearts remaining">${[0, 1, 2].map((index) => `<span class="heart ${index < hearts ? 'live' : 'lost'}" aria-hidden="true">♥</span>`).join('')}</div>
      <button class="icon-button restart-button" data-action="restart" aria-label="Restart level" type="button">↻</button>
    </header>
    <div class="prompt-row" aria-live="polite">${notice || 'Tap an arrow to send it out.'}</div>
    ${boardMarkup()}
    <div class="game-bottom"><span class="remaining"><b>${arrows.length}</b><small> ${arrows.length === 1 ? 'arrow' : 'arrows'} left</small></span>${QA_MODE ? '<span class="qa-badge">QA</span>' : '<span class="bottom-mark">ARROW ADVENTURE</span>'}</div>
    ${noHearts ? `<div class="scrim"><section class="modal-card" role="dialog" aria-modal="true"><div class="eyebrow">TAKE ANOTHER LOOK</div><h2>Out of hearts.</h2><p>Restart and look for the arrow that must clear first.</p><button class="primary-button" data-action="restart">Restart level <span>↻</span></button></section></div>` : ''}
  </main>`;
  bindQATrigger();
}

function attemptMove(id: string): void {
  if (busy || view !== 'game') return;
  const arrow = arrows.find((item) => item.id === id);
  if (!arrow) return;
  if (!actionGate.accept(performance.now())) return;
  const moveStrokeWidth = strokeWidth;
  const result = simulateMove(arrow, arrows.filter((item) => item.id !== id), level.width, level.height, moveStrokeWidth);
  if (!result.ok) {
    hearts = loseHeart(hearts);
    notice = 'That arrow is blocked by another one.';
    shakeId = id;
    if (hearts <= 0) view = 'out';
    render();
    window.setTimeout(() => { shakeId = null; }, 450);
    return;
  }

  busy = true;
  animatingId = id;
  notice = '';
  const token = ++animationToken;
  const moving = arrows.find((item) => item.id === id)!;
  const movingGroup = [...app.querySelectorAll<SVGGElement>('[data-arrow]')].find((item) => item.dataset.arrow === id);
  movingGroup?.classList.add('moving');
  movingGroup?.style.setProperty('--arrow-stroke-width', String(moveStrokeWidth));
  const original = moving.path.map((point) => ({ ...point }));
  const travelLength = result.travelDistance;
  const started = performance.now();
  const speed = 5.5 * speedMultiplier; // Visual timing only; legality was decided above.
  const animate = (now: number): void => {
    if (token !== animationToken || view !== 'game') return;
    const traveled = Math.min(travelLength, (now - started) / 1000 * speed);
    const centers = moveArrowDistance({ ...moving, path: original }, traveled);
    const livePath = centers.map(({ x, y }) => ({ x: x - 0.5, y: y - 0.5 }));
    moving.path = livePath;
    if (!movingGroup) { busy = false; animatingId = null; return; }
    const line = movingGroup.querySelector<SVGPolylineElement>('.arrow-line')!;
    line.setAttribute('points', pointString(livePath));
    const tail = livePath[0];
    movingGroup.querySelector<SVGCircleElement>('.tail-dot')!.setAttribute('cx', `${tail.x + 0.5}`);
    movingGroup.querySelector<SVGCircleElement>('.tail-dot')!.setAttribute('cy', `${tail.y + 0.5}`);
    const [tip, wingA, wingB] = arrowHeadTriangle(livePath, moveStrokeWidth);
    movingGroup.querySelector<SVGPathElement>('.arrow-head')!.setAttribute('d', `M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z`);
    if (traveled < travelLength) { requestAnimationFrame(animate); return; }
    arrows = arrows.filter((item) => item.id !== id);
    animatingId = null;
    busy = false;
    if (completeLevel(arrows)) {
      const next = advanceSession(session, CURATED_LEVELS.length);
      if (next) session = next;
      view = 'complete';
    }
    render();
  };
  requestAnimationFrame(animate);
}

function boardPointFromEvent(event: PointerEvent, board: SVGSVGElement): Point | undefined {
  const transform = board.getScreenCTM();
  if (!transform) return undefined;
  const point = board.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  const local = point.matrixTransform(transform.inverse());
  return { x: local.x, y: local.y };
}

app.addEventListener('pointerdown', (event) => {
  if (busy || view !== 'game' || event.button !== 0) return;
  const board = (event.target as Element).closest<SVGSVGElement>('.board');
  if (!board) return;
  const point = boardPointFromEvent(event, board);
  if (!point) return;
  const id = nearestArrowAt(point, arrows);
  if (!id) return;
  event.preventDefault();
  void attemptMove(id);
});

app.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLElement>('[data-action]');
  if (!button?.dataset.action) return;
  const action = button.dataset.action;
  if (action === 'restart') startLevel(catalogEntry.number);
  if (action === 'next') startLevel(session.levelNumber);
  if (action === 'replay') startLevel(1);
});

app.addEventListener('keydown', (event) => {
  const arrow = (event.target as Element).closest<SVGGElement>('[data-arrow]');
  if (arrow && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (arrow.dataset.arrow) void attemptMove(arrow.dataset.arrow); }
});

function applyStroke(width: number): void {
  strokeWidth = width;
  document.documentElement.style.setProperty('--arrow-stroke-width', String(width));
  for (const arrow of arrows) {
    if (arrow.id === animatingId) continue;
    const group = [...app.querySelectorAll<SVGGElement>('[data-arrow]')].find((item) => item.dataset.arrow === arrow.id);
    const head = group?.querySelector<SVGPathElement>('.arrow-head');
    if (!head) continue;
    const [tip, wingA, wingB] = arrowHeadTriangle(arrow.path, width);
    head.setAttribute('d', `M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z`);
  }
}

startLevel(1);
if (QA_MODE) {
  void import('./qa/qaPanel').then(({ mountQAPanel }) => {
    qaPanel = mountQAPanel({
      onSpeed: (value) => { speedMultiplier = value; },
      onStroke: applyStroke,
      onDiagnostics: (value) => { diagnostics = value; if (!busy) render(); },
      onLevel: startLevel,
      onRestart: () => startLevel(catalogEntry.number),
      candidateSha: import.meta.env.VITE_CANDIDATE_SHA,
    });
    render();
  });
}
