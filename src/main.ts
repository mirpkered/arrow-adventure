import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel } from './game/catalog';
import { advanceSession, createRun, createSession, loseHeart, type PrototypeSession } from './game/session';
import { completeLevel, directionName, exitDirection, moveArrowDistance, nearestArrowAt, simulateMove } from './game/rules';
import { arrowHeadTriangle } from './game/geometry';
import type { Arrow, Level, Point } from './game/types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
let session: PrototypeSession = createSession();
let catalogEntry = getCuratedLevel(session.levelNumber)!;
let level: Level = catalogEntry.puzzle;
let arrows: Arrow[] = [];
let hearts = 3;
let busy = false;
let notice = '';
let view: 'title' | 'game' | 'complete' | 'out' = 'title';
let animatingId: string | null = null;
let shakeId: string | null = null;
let animationToken = 0;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function startLevel(number: number): void {
  animationToken += 1;
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

function arrowMarkup(arrow: Arrow): string {
  const direction = exitDirection(arrow);
  const [tip, wingA, wingB] = arrowHeadTriangle(arrow.path);
  const classes = [animatingId === arrow.id ? 'arrow moving' : 'arrow', shakeId === arrow.id ? 'shaking' : ''].join(' ');
  const tail = arrow.path[0];
  const points = pointString(arrow.path);
  return `<g class="${classes}" data-arrow="${escapeHtml(arrow.id)}" role="button" tabindex="0" aria-label="Arrow facing ${directionName(direction)}, ${arrow.path.length - 1} segments">
    <polyline class="arrow-line" points="${points}" />
    <circle class="tail-dot" cx="${tail.x + 0.5}" cy="${tail.y + 0.5}" r=".13" />
    <path class="arrow-head" d="M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z" />
  </g>`;
}

function boardMarkup(): string {
  const grid = [];
  for (let x = 1; x < level.width; x += 1) grid.push(`<path d="M ${x} 0 V ${level.height}" />`);
  for (let y = 1; y < level.height; y += 1) grid.push(`<path d="M 0 ${y} H ${level.width}" />`);
  return `<div class="board-wrap"><svg class="board" width="100%" height="100%" viewBox="-0.22 -0.22 ${level.width + 0.44} ${level.height + 0.44}" role="group" aria-label="Puzzle board, ${arrows.length} arrows remaining">
    <rect class="board-bg" x="-.2" y="-.2" width="${level.width + 0.4}" height="${level.height + 0.4}" rx=".42" />
    <g class="grid-lines">${grid.join('')}</g>
    ${arrows.map(arrowMarkup).join('')}
  </svg></div>`;
}

function render(): void {
  if (view === 'title') {
    app.innerHTML = `<main class="screen title-screen">
      <section class="title-content">
        <img class="title-logo" src="${import.meta.env.BASE_URL}branding/arrow-adventure-official-logo.png" alt="Arrow Adventure" width="1254" height="1254" />
        <p class="intro">Unthread the winding arrows.</p>
        <button class="primary-button" data-action="play">Start at Level 1 <span>→</span></button>
        <p class="quiet-note">${CURATED_LEVELS.length} handcrafted prototype puzzles · No saved progress</p>
      </section>
      <footer class="title-footer">A puzzle adventure by <strong>Mirpworks</strong></footer>
    </main>`;
    return;
  }

  if (view === 'complete') {
    const next = getNextCuratedLevel(catalogEntry);
    app.innerHTML = `<main class="screen finish-screen"><div class="brand compact"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>MIRPWORKS <b>ADVENTURE</b></span></div>
      <section class="finish-card"><div class="finish-spark">✳</div><div class="eyebrow">${next ? `LEVEL ${catalogEntry.number} COMPLETE` : 'PROTOTYPE COMPLETE'}</div><h1>${next ? 'All clear.' : 'Nicely untangled.'}</h1><p>${next ? 'Every arrow found its way out.' : 'You cleared the current curated set.'}</p>
      <div class="finish-stats"><span>Arrows cleared</span><b>${level.arrows.length} / ${level.arrows.length}</b></div>
      <button class="primary-button" data-action="${next ? 'next' : 'replay'}">${next ? `Next · Level ${next.number}` : 'Replay from Level 1'} <span>→</span></button>
      <button class="text-button" data-action="home">Back to title</button></section></main>`;
    return;
  }

  const noHearts = view === 'out';
  app.innerHTML = `<main class="screen game-screen">
    <header class="game-header"><button class="icon-button home-button" data-action="home" aria-label="Back to title">⌂</button><div class="brand compact"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>MIRPWORKS <b>ADVENTURE</b></span></div><button class="icon-button restart-button" data-action="restart" aria-label="Restart level">↻</button></header>
    <div class="level-row"><div class="level-title">LEVEL <strong>${catalogEntry.number}</strong><span class="level-name">${escapeHtml(catalogEntry.title)}</span></div><div class="hearts" aria-label="${hearts} of 3 hearts remaining">${[0, 1, 2].map((index) => `<span class="heart ${index < hearts ? 'live' : 'lost'}">♥</span>`).join('')}</div></div>
    <div class="prompt-row"><span class="prompt-icon">↗</span><span>${notice || 'Tap an arrow to trace its path out.'}</span></div>
    ${boardMarkup()}
    <div class="game-bottom"><span class="remaining">${arrows.length} <small>${arrows.length === 1 ? 'arrow' : 'arrows'} left</small></span><span class="bottom-hint">Watch how paths share the board</span></div>
    ${noHearts ? `<div class="scrim"><section class="modal-card"><div class="modal-icon">↻</div><div class="eyebrow">TAKE ANOTHER LOOK</div><h2>Out of hearts.</h2><p>Try the level again and look for a path that must clear first.</p><button class="primary-button" data-action="restart">Restart level <span>↻</span></button><button class="text-button" data-action="home">Back to title</button></section></div>` : ''}
  </main>`;
}

function attemptMove(id: string): void {
  if (busy || view !== 'game') return;
  const arrow = arrows.find((item) => item.id === id);
  if (!arrow) return;
  const result = simulateMove(arrow, arrows.filter((item) => item.id !== id), level.width, level.height);
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
  const original = moving.path.map((point) => ({ ...point }));
  const travelLength = result.travelDistance;
  const started = performance.now();
  const speed = 5.5; // Board cells per second; independent of display refresh rate.
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
    const [tip, wingA, wingB] = arrowHeadTriangle(livePath);
    movingGroup.querySelector<SVGPathElement>('.arrow-head')!.setAttribute('d', `M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z`);
    if (traveled < travelLength) {
      requestAnimationFrame(animate);
      return;
    }
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
  const point = board.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
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
  const target = event.target as Element;
  const button = target.closest<HTMLElement>('[data-action]');
  if (button?.dataset.action) {
    const action = button.dataset.action;
    if (action === 'play') { session = createSession(); startLevel(session.levelNumber); }
    if (action === 'restart') startLevel(catalogEntry.number);
    if (action === 'home') { view = 'title'; render(); }
    if (action === 'next') startLevel(session.levelNumber);
    if (action === 'replay') { session = createSession(); startLevel(session.levelNumber); }
    return;
  }
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
