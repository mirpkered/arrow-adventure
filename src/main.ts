import { CURATED_LEVELS, getCuratedLevel, getNextCuratedLevel } from './game/catalog';
import { completeLevel, directionName, exitDirection, moveArrowDistance, nearestArrowAt, simulateMove, solveLevel } from './game/rules';
import { createActionGate } from './game/input';
import { advanceSession, createRun, loseHeart, type PrototypeSession } from './game/session';
import { ARROW_STROKE_WIDTH, arrowHeadTriangle, toBoardPoint, toPathPoint } from './game/geometry';
import { GameAudio } from './app/audio';
import { movementDuration, NORMAL_MOVE_SPEED, RETURN_MOVE_SPEED } from './app/motion';
import { loadGameSave, loadSettings, prefersDarkTheme, saveGame, saveSettings, storageKeysFor, type Appearance, type GameSave, type PlayerSettings, type StorageLike } from './app/persistence';
import { showLaunchSplash } from './app/launchSplash';
import { BoardViewport } from './app/viewport';
import { boardGridMarkup } from './app/boardGrid';
import type { Arrow, Level, Point } from './game/types';
import { legalMoves } from './game/stateAudit';
import type { DiagnosticFlags, QABoardSnapshot } from './qa/qaPanel';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const QA_MODE = import.meta.env.DEV || import.meta.env.VITE_QA_MODE === 'true';
const BASE = import.meta.env.BASE_URL;
const storageKeys = storageKeysFor(import.meta.env.VITE_QA_MODE === 'true' ? 'qa' : 'production');
const actionGate = createActionGate(220);
const audio = new GameAudio();
const storage: StorageLike | undefined = (() => { try { return window.localStorage; } catch { return undefined; } })();

showLaunchSplash(document, window, `${BASE}branding/mirpworks-logo.jpg`);

let settings: PlayerSettings = storage ? loadSettings(storage, storageKeys) : { version: 1, appearance: 'light', backgroundMusic: false, soundEffects: true };
audio.setPreferences(settings.backgroundMusic, settings.soundEffects);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (settings.appearance === 'automatic') applyAppearance();
});

type Screen = 'title' | 'settings' | 'credits' | 'game' | 'pause' | 'complete' | 'out';
let screen: Screen = 'title';
let settingsReturn: 'title' | 'pause' = 'title';
let savedGame: GameSave | null = storage ? loadGameSave(storage, CURATED_LEVELS, storageKeys) : null;
let session: PrototypeSession = { levelNumber: 1 };
let catalogEntry = getCuratedLevel(1)!;
let level: Level = catalogEntry.puzzle;
let arrows: Arrow[] = [];
let completedIds = new Set<string>(savedGame?.completedLevelIds ?? []);
let hearts = 3;
let redArrowIds = new Set<string>();
let busy = false;
let temporaryQARun = false;
let qaHighlightedArrowId: string | null = null;
let notice = '';
let animatingId: string | null = null;
let animationToken = 0;
let speedMultiplier = 2;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let strokeWidth = ARROW_STROKE_WIDTH;
let diagnostics: DiagnosticFlags = { ids: false, ownership: false, hitTargets: false, geometry: false };
let qaPanel: { open: () => void; bind: (target: HTMLElement, open: () => void) => () => void } | undefined;
let unbindHold: (() => void) | undefined;
let viewport = new BoardViewport(level.width, level.height);
const activePointers = new Map<number, Point>();
let pointerOrigin: Point | undefined;
let pointerMoved = false;
let pinchDistance: number | undefined;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const gameLogo = `${BASE}branding/arrow-adventure-official-logo.png`;

function applyAppearance(): void {
  if (settings.appearance === 'automatic') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = settings.appearance;
  const dark = prefersDarkTheme(settings.appearance, window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17191D' : '#F7F7F2');
}

function applyStrokeWidth(): void {
  document.documentElement.style.setProperty('--arrow-stroke-width', String(strokeWidth));
}

function getLevel(number: number) { return getCuratedLevel(number); }

function activeSave(levelComplete = screen === 'complete'): GameSave {
  return {
    version: 1,
    currentLevelId: catalogEntry.id,
    completedLevelIds: [...completedIds],
    remainingArrowIds: levelComplete ? [] : arrows.map(({ id }) => id),
    redArrowIds: [...redArrowIds].filter((id) => arrows.some((arrow) => arrow.id === id)),
    hearts,
    levelComplete,
  };
}

/** Saves only stable board states. Animation frames are never persisted. */
function persistProgress(levelComplete = screen === 'complete'): void {
  if (!storage || busy || (QA_MODE && temporaryQARun)) return;
  const next = activeSave(levelComplete);
  if (saveGame(storage, next, storageKeys)) savedGame = next;
}

function startLevel(number: number, temporaryQA = false): void {
  animationToken += 1;
  actionGate.reset();
  const entry = getLevel(number);
  if (!entry) return;
  temporaryQARun = temporaryQA;
  qaHighlightedArrowId = null;
  session = { levelNumber: entry.number };
  catalogEntry = entry;
  level = entry.puzzle;
  const run = createRun(level);
  arrows = run.arrows;
  hearts = run.hearts;
  redArrowIds = new Set();
  notice = '';
  busy = false;
  animatingId = null;
  screen = 'game';
  viewport.reset(level.width, level.height);
  if (!temporaryQARun) persistProgress(false);
  render();
}

function startNewGame(): void {
  completedIds = new Set(savedGame?.completedLevelIds ?? []);
  startLevel(1);
}

function continueGame(): void {
  const save = storage ? loadGameSave(storage, CURATED_LEVELS, storageKeys) : savedGame;
  if (!save) { startNewGame(); return; }
  temporaryQARun = false;
  const entry = CURATED_LEVELS.find(({ id }) => id === save.currentLevelId) ?? CURATED_LEVELS[0];
  catalogEntry = entry;
  level = entry.puzzle;
  session = { levelNumber: entry.number };
  completedIds = new Set(save.completedLevelIds);
  arrows = level.arrows.filter(({ id }) => save.remainingArrowIds.includes(id)).map((arrow) => ({ ...arrow, path: arrow.path.map((point) => ({ ...point })) }));
  hearts = save.hearts;
  redArrowIds = new Set(save.redArrowIds);
  notice = '';
  busy = false;
  animatingId = null;
  screen = save.levelComplete ? 'complete' : save.hearts === 0 ? 'out' : 'game';
  viewport.reset(level.width, level.height);
  render();
}

function pointString(points: Point[]): string { return points.map((point) => { const board = toBoardPoint(point); return `${board.x},${board.y}`; }).join(' '); }
function qaArrowColor(id: string): string { let hash = 0; for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return `hsl(${hash % 360} 65% 48%)`; }

function arrowMarkup(arrow: Arrow): string {
  const [tip, wingA, wingB] = arrowHeadTriangle(arrow.path);
  const classes = ['arrow', animatingId === arrow.id ? 'moving' : '', redArrowIds.has(arrow.id) ? 'is-red' : '', qaHighlightedArrowId === arrow.id ? 'qa-safe-highlight' : ''].filter(Boolean).join(' ');
  const points = pointString(arrow.path);
  const tail = toBoardPoint(arrow.path[0]);
  const middle = arrow.path[Math.floor(arrow.path.length / 2)];
  const color = redArrowIds.has(arrow.id) ? 'var(--danger)' : diagnostics.ownership ? qaArrowColor(arrow.id) : 'var(--arrow-ink)';
  return `<g class="${classes}" data-arrow="${escapeHtml(arrow.id)}" role="button" tabindex="0" aria-label="Arrow facing ${directionName(exitDirection(arrow))}, ${Math.round(arrow.path.length - 1)} path points" style="--arrow-current-color:${color}">
    ${diagnostics.hitTargets ? `<polyline class="debug-hit" points="${points}" />` : ''}
    <polyline class="arrow-line" points="${points}" />
    <circle class="tail-dot" cx="${tail.x}" cy="${tail.y}" r=".09" />
    <path class="arrow-head" d="M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z" />
    ${diagnostics.ids ? `<text class="debug-id" x="${toBoardPoint(middle).x}" y="${toBoardPoint(middle).y}">${escapeHtml(arrow.id)}</text>` : ''}
  </g>`;
}

function boardMarkup(): string {
  const box = viewport.viewBox;
  return `<div class="board-wrap"><svg class="board" width="100%" height="100%" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" role="group" aria-label="Puzzle board, ${arrows.length} arrows remaining" aria-roledescription="zoomable puzzle board">
    ${boardGridMarkup(level.width, level.height, diagnostics.geometry)}${arrows.map(arrowMarkup).join('')}
  </svg></div>`;
}

function updateHearts(): void {
  const holder = app.querySelector<HTMLElement>('.hearts');
  if (!holder) return;
  holder.setAttribute('aria-label', `${hearts} of 3 hearts remaining`);
  holder.innerHTML = [0, 1, 2].map((index) => `<span class="heart ${index < hearts ? 'live' : 'lost'}" aria-hidden="true">♥</span>`).join('');
}

function updateAnimatedArrow(group: SVGGElement, arrow: Arrow, path: Point[]): void {
  arrow.path = path;
  const line = group.querySelector<SVGPolylineElement>('.arrow-line');
  const tailDot = group.querySelector<SVGCircleElement>('.tail-dot');
  const head = group.querySelector<SVGPathElement>('.arrow-head');
  if (!line || !tailDot || !head) return;
  line.setAttribute('points', pointString(path));
  const tail = toBoardPoint(path[0]);
  tailDot.setAttribute('cx', `${tail.x}`);
  tailDot.setAttribute('cy', `${tail.y}`);
  const [tip, wingA, wingB] = arrowHeadTriangle(path);
  head.setAttribute('d', `M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z`);
}

function animateDistance(arrow: Arrow, group: SVGGElement, startDistance: number, endDistance: number, speed: number, token: number, done: () => void): void {
  const startedAt = performance.now();
  const duration = movementDuration(Math.abs(endDistance - startDistance), speed, reducedMotion);
  const original = arrow.path.map((point) => ({ ...point }));
  const tick = (now: number) => {
    if (token !== animationToken) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const traveled = startDistance + (endDistance - startDistance) * progress;
    const path = moveArrowDistance({ ...arrow, path: original }, traveled).map(toPathPoint);
    updateAnimatedArrow(group, arrow, path);
    if (progress < 1) requestAnimationFrame(tick);
    else done();
  };
  requestAnimationFrame(tick);
}

function finishStableAction(): void {
  animatingId = null;
  busy = false;
  actionGate.reset();
  if (hearts <= 0) screen = 'out';
  persistProgress(false);
  render();
}

function attemptMove(id: string): void {
  if (busy || screen !== 'game') return;
  const arrow = arrows.find((item) => item.id === id);
  if (!arrow || !actionGate.accept(performance.now())) return;
  const result = simulateMove(arrow, arrows.filter((item) => item.id !== id), level.width, level.height);
  const group = [...app.querySelectorAll<SVGGElement>('[data-arrow]')].find((item) => item.dataset.arrow === id);
  if (!group) return;
  const original = arrow.path.map((point) => ({ ...point }));
  busy = true;
  animatingId = id;
  group.classList.add('moving');
  const token = ++animationToken;
  if (!result.ok) {
    hearts = loseHeart(hearts);
    notice = `Blocked by another arrow. ${hearts} ${hearts === 1 ? 'heart' : 'hearts'} left.`;
    updateHearts();
    const noticeNode = app.querySelector<HTMLElement>('.prompt-row');
    if (noticeNode) noticeNode.textContent = notice;
    animateDistance(arrow, group, 0, result.travelDistance, NORMAL_MOVE_SPEED * speedMultiplier, token, () => {
      if (token !== animationToken) return;
      redArrowIds.add(id);
      group.classList.add('is-red', 'at-impact');
      window.setTimeout(() => group.classList.remove('at-impact'), 120);
      audio.play('blocked');
      const returning = { ...arrow, path: original.map((point) => ({ ...point })) };
      animateDistance(returning, group, result.travelDistance, 0, RETURN_MOVE_SPEED * speedMultiplier, token, () => {
        arrow.path = original;
        finishStableAction();
      });
    });
    return;
  }

  notice = '';
  const noticeNode = app.querySelector<HTMLElement>('.prompt-row');
  if (noticeNode) noticeNode.textContent = '';
  const moving = { ...arrow, path: original.map((point) => ({ ...point })) };
  animateDistance(moving, group, 0, result.travelDistance, NORMAL_MOVE_SPEED * speedMultiplier, token, () => {
    if (token !== animationToken) return;
    arrows = arrows.filter((item) => item.id !== id);
    redArrowIds.delete(id);
    animatingId = null;
    busy = false;
    actionGate.reset();
    audio.play('clear');
    if (completeLevel(arrows)) {
      completedIds.add(catalogEntry.id);
      const next = advanceSession(session, CURATED_LEVELS.length);
      if (next) session = next;
      screen = 'complete';
      audio.play('level');
      persistProgress(true);
    } else persistProgress(false);
    render();
  });
}

function eventBoardPoint(event: PointerEvent, board: SVGSVGElement): Point | undefined {
  const transform = board.getScreenCTM();
  if (!transform) return undefined;
  const point = board.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  const local = point.matrixTransform(transform.inverse());
  return { x: local.x, y: local.y };
}

function pointerDistance(a: Point, b: Point): number { return Math.hypot(b.x - a.x, b.y - a.y); }
function pointerCenter(points: Point[]): Point { return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }; }

function handleBoardPointerDown(event: PointerEvent): void {
  if (screen !== 'game' || event.button !== 0) return;
  const board = (event.target as Element).closest<SVGSVGElement>('.board');
  if (!board) return;
  const point = eventBoardPoint(event, board);
  if (!point) return;
  event.preventDefault();
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  try { board.setPointerCapture(event.pointerId); } catch { /* Capture is optional in SVG/WebKit. */ }
  if (activePointers.size === 1) {
    pointerOrigin = { x: event.clientX, y: event.clientY };
    pointerMoved = false;
    pinchDistance = undefined;
  } else if (activePointers.size === 2) {
    const values = [...activePointers.values()];
    pinchDistance = pointerDistance(values[0], values[1]);
    pointerOrigin = pointerCenter(values);
    pointerMoved = true;
  }
}

function handleBoardPointerMove(event: PointerEvent): void {
  if (!activePointers.has(event.pointerId) || busy || screen !== 'game') return;
  const board = (event.target as Element).closest<SVGSVGElement>('.board') ?? app.querySelector<SVGSVGElement>('.board');
  if (!board) return;
  const previous = activePointers.get(event.pointerId)!;
  const next = { x: event.clientX, y: event.clientY };
  activePointers.set(event.pointerId, next);
  if (activePointers.size >= 2) {
    const values = [...activePointers.values()];
    const distanceNow = pointerDistance(values[0], values[1]);
    const centerNow = pointerCenter(values);
    const focal = eventBoardPoint({ ...event, clientX: centerNow.x, clientY: centerNow.y } as PointerEvent, board);
    if (focal && pinchDistance && pinchDistance > 0) viewport.zoomAt(distanceNow / pinchDistance, focal);
    pinchDistance = distanceNow;
    const pixelScale = Math.min(board.clientWidth / viewport.viewBox.width, board.clientHeight / viewport.viewBox.height);
    const deltaX = (centerNow.x - (pointerOrigin?.x ?? centerNow.x)) / Math.max(pixelScale, 1e-6);
    const deltaY = (centerNow.y - (pointerOrigin?.y ?? centerNow.y)) / Math.max(pixelScale, 1e-6);
    if (Math.abs(deltaX) + Math.abs(deltaY) > 0) viewport.panBy(deltaX, deltaY);
    pointerOrigin = centerNow;
    pointerMoved = true;
    board.setAttribute('viewBox', `${viewport.viewBox.x} ${viewport.viewBox.y} ${viewport.viewBox.width} ${viewport.viewBox.height}`);
    return;
  }
  if (!pointerOrigin) return;
  if (pointerDistance(pointerOrigin, next) > 8) pointerMoved = true;
  if (!pointerMoved) return;
  const pixelScale = Math.min(board.clientWidth / viewport.viewBox.width, board.clientHeight / viewport.viewBox.height);
  viewport.panBy((next.x - previous.x) / Math.max(pixelScale, 1e-6), (next.y - previous.y) / Math.max(pixelScale, 1e-6));
  board.setAttribute('viewBox', `${viewport.viewBox.x} ${viewport.viewBox.y} ${viewport.viewBox.width} ${viewport.viewBox.height}`);
}

function handleBoardPointerUp(event: PointerEvent): void {
  if (!activePointers.has(event.pointerId)) return;
  const board = (event.target as Element).closest<SVGSVGElement>('.board') ?? app.querySelector<SVGSVGElement>('.board');
  const isTap = activePointers.size === 1 && !pointerMoved;
  activePointers.delete(event.pointerId);
  if (isTap && board && screen === 'game' && !busy) {
    const point = eventBoardPoint(event, board);
    const id = point && nearestArrowAt(point, arrows);
    if (id) attemptMove(id);
  }
  if (activePointers.size === 0) {
    pointerOrigin = undefined;
    pinchDistance = undefined;
    pointerMoved = false;
  } else pointerMoved = true;
}

function bindQATrigger(): void {
  unbindHold?.();
  if (!QA_MODE || !qaPanel) return;
  const trigger = app.querySelector<HTMLElement>('#level-hold');
  if (trigger) unbindHold = qaPanel.bind(trigger, qaPanel.open);
}

function inspectCurrentBoard(selectedArrowId?: string): QABoardSnapshot {
  const selected = arrows.find(({ id }) => id === selectedArrowId) ?? arrows[0];
  if (busy) return {
    levelNumber: catalogEntry.number,
    remainingArrowIds: arrows.map(({ id }) => id),
    legalArrowIds: [],
    solution: null,
    selectedArrowId: selected?.id,
    selectedCanEscape: null,
    collision: null,
    animating: true,
  };
  const currentLevel: Level = { ...level, arrows };
  const safe = legalMoves(currentLevel).map(({ arrow }) => arrow.id);
  const solution = solveLevel(currentLevel);
  const result = selected ? simulateMove(selected, arrows.filter(({ id }) => id !== selected.id), level.width, level.height) : undefined;
  return {
    levelNumber: catalogEntry.number,
    remainingArrowIds: arrows.map(({ id }) => id),
    legalArrowIds: safe,
    solution,
    selectedArrowId: selected?.id,
    selectedCanEscape: result ? result.ok : null,
    collision: result && !result.ok ? { blockedBy: result.blockedBy, travelDistance: result.travelDistance } : null,
    animating: false,
  };
}

function renderTitle(): void {
  const hasSave = !!savedGame;
  const savedLevelNumber = savedGame ? CURATED_LEVELS.find(({ id }) => id === savedGame!.currentLevelId)?.number ?? 1 : 1;
  const continueLevel = savedGame ? savedGame.levelComplete ? Math.min(savedLevelNumber + 1, CURATED_LEVELS.length) : savedLevelNumber : 1;
  app.innerHTML = `<main class="app-screen title-screen">
    <img class="title-landscape" src="${BASE}branding/arrow-adventure-title-scene.svg" alt="" aria-hidden="true" />
    <div class="title-atmosphere" aria-hidden="true"></div>
    <header class="title-brand">
      <span class="title-overline">A MIRPWORKS GAME</span>
      <h1 class="title-wordmark"><span>ARROW</span><em>ADVENTURE</em></h1>
      <p class="title-tagline">Untangle the way out.</p>
    </header>
    <nav class="title-actions" aria-label="Main menu">
      <button class="primary-button title-play" data-action="play"><span class="title-play-icon" aria-hidden="true">➜</span>PLAY</button>
      ${hasSave ? `<button class="secondary-button title-continue" data-action="continue"><span>CONTINUE</span><small>LEVEL ${continueLevel} <b aria-hidden="true">→</b></small></button>` : ''}
      <div class="title-secondary-actions">
        <button class="secondary-button title-secondary" data-action="settings"><span class="title-action-icon" aria-hidden="true">⚙</span><span>Settings</span></button>
        <button class="secondary-button title-secondary" data-action="credits"><span class="title-action-icon" aria-hidden="true">✦</span><span>Credits</span></button>
      </div>
      <span class="title-signature">MIRPWORKS · LET’S PLAY A GAME</span>
    </nav>
  </main>`;
}

function renderSettings(): void {
  app.innerHTML = `<main class="app-screen sub-screen settings-screen">
    <header class="sub-header"><button class="icon-button" data-action="back" aria-label="Back">‹</button><div><span class="eyebrow">PREFERENCES</span><h1>Settings</h1></div><span class="header-spacer"></span></header>
    <section class="settings-group"><h2>Appearance</h2><p>Choose a look that feels comfortable.</p><div class="segmented-control" role="group" aria-label="Appearance">
      ${(['light','dark','automatic'] as Appearance[]).map((mode) => `<button data-appearance="${mode}" aria-pressed="${settings.appearance === mode}">${mode === 'automatic' ? 'Auto' : mode[0].toUpperCase() + mode.slice(1)}</button>`).join('')}
    </div></section>
    <section class="settings-group"><h2>Sound</h2><p>Audio is optional. Music is an original, gentle synthesized loop and only starts after you enable it.</p>
      <button class="setting-row" data-setting="backgroundMusic" aria-pressed="${settings.backgroundMusic}"><span><b>Background music</b><small>Plays only when enabled</small></span><span class="toggle"><i></i></span></button>
      <button class="setting-row" data-setting="soundEffects" aria-pressed="${settings.soundEffects}"><span><b>Sound effects</b><small>Arrow clears and collisions</small></span><span class="toggle"><i></i></span></button>
    </section>
    <div class="settings-footnote">Your appearance and audio choices are saved on this device.</div>
  </main>`;
}

function renderCredits(): void {
  app.innerHTML = `<main class="app-screen sub-screen credits-screen">
    <header class="sub-header"><button class="icon-button" data-action="back" aria-label="Back">‹</button><div><span class="eyebrow">THE PEOPLE BEHIND THE PUZZLE</span><h1>Credits</h1></div><span class="header-spacer"></span></header>
    <section class="credits-mark"><img src="${gameLogo}" alt="Arrow Adventure" /><h2>ARROW ADVENTURE</h2><p>A Mirpworks Game</p></section>
    <div class="credits-spacer"></div><button class="primary-button" data-action="back">BACK TO MENU</button>
  </main>`;
}

function renderGame(): void {
  const isPaused = screen === 'pause';
  const isOut = screen === 'out';
  app.innerHTML = `<main class="app-screen game-screen">
    <header class="game-header">
      <button id="level-hold" class="level-trigger" type="button" aria-label="Level ${catalogEntry.number}${QA_MODE ? '. Hold for QA settings' : ''}" title="Level ${catalogEntry.number}"><span class="level-kicker">LEVEL</span><strong>${catalogEntry.number}</strong></button>
      <div class="hearts" aria-label="${hearts} of 3 hearts remaining">${[0,1,2].map((index) => `<span class="heart ${index < hearts ? 'live' : 'lost'}" aria-hidden="true">♥</span>`).join('')}</div>
      <button class="icon-button restart-button" data-action="restart" aria-label="Restart puzzle" type="button">↻</button>
      <button class="icon-button view-button" data-action="zoom-reset" aria-label="Reset puzzle zoom" type="button">⌖</button>
      <button class="icon-button menu-button" data-action="pause" aria-label="Pause and menu" type="button">Ⅱ</button>
    </header>
    <div class="prompt-row" aria-live="polite">${escapeHtml(notice || 'Find an arrow with a clear path out.')}</div>
    ${boardMarkup()}
    <footer class="game-bottom"><span>${arrows.length} ${arrows.length === 1 ? 'arrow' : 'arrows'} remaining</span><span class="level-progress">${catalogEntry.number} / ${CURATED_LEVELS.length}</span></footer>
    ${isPaused ? `<div class="overlay-scrim"><section class="menu-sheet" role="dialog" aria-modal="true" aria-labelledby="pause-title"><button class="sheet-close" data-action="resume" aria-label="Resume">×</button><span class="eyebrow">PUZZLE PAUSED</span><h2 id="pause-title">Take your time.</h2><button class="primary-button" data-action="resume">RESUME</button><button class="secondary-button" data-action="restart">RESTART PUZZLE</button><button class="secondary-button" data-action="settings">SETTINGS</button><button class="quiet-button" data-action="title">RETURN TO TITLE</button></section></div>` : ''}
    ${isOut ? `<div class="overlay-scrim"><section class="menu-sheet" role="dialog" aria-modal="true" aria-labelledby="out-title"><span class="eyebrow">THREE HEARTS USED</span><h2 id="out-title">Try another route.</h2><button class="primary-button" data-action="restart">RESTART PUZZLE</button><button class="secondary-button" data-action="title">RETURN TO TITLE</button></section></div>` : ''}
  </main>`;
  bindQATrigger();
}

function renderCompletion(): void {
  const next = getNextCuratedLevel(catalogEntry);
  app.innerHTML = `<main class="app-screen completion-screen"><div class="completion-symbol">✳</div><span class="eyebrow">${next ? `LEVEL ${catalogEntry.number} COMPLETE` : 'ADVENTURE COMPLETE'}</span><h1>${next ? 'All clear.' : 'Beautifully untangled.'}</h1><p>${next ? 'Every arrow found a way out.' : 'You cleared every puzzle in the adventure.'}</p>
    <div class="completion-stat"><span>Arrows cleared</span><b>${level.arrows.length} / ${level.arrows.length}</b></div>
    ${next ? `<button class="primary-button" data-action="next">NEXT LEVEL <span>→</span></button>` : '<button class="primary-button" data-action="title">RETURN TO TITLE</button>'}
    <button class="quiet-button" data-action="title">MENU</button>
  </main>`;
}

function render(): void {
  applyAppearance();
  if (screen === 'title') renderTitle();
  else if (screen === 'settings') renderSettings();
  else if (screen === 'credits') renderCredits();
  else if (screen === 'complete') renderCompletion();
  else renderGame();
}

function saveSettingsNow(): void {
  if (storage) saveSettings(storage, settings, storageKeys);
  audio.setPreferences(settings.backgroundMusic, settings.soundEffects);
  applyAppearance();
}

function openSettings(): void {
  settingsReturn = screen === 'pause' ? 'pause' : 'title';
  if (screen === 'game') { screen = 'pause'; settingsReturn = 'pause'; }
  screen = 'settings';
  render();
}

function returnFromSettings(): void {
  screen = settingsReturn;
  render();
}

app.addEventListener('pointerdown', () => audio.activate());
app.addEventListener('pointerdown', handleBoardPointerDown);
app.addEventListener('pointermove', handleBoardPointerMove);
app.addEventListener('pointerup', handleBoardPointerUp);
app.addEventListener('pointercancel', handleBoardPointerUp);

app.addEventListener('click', (event) => {
  const element = (event.target as Element).closest<HTMLElement>('[data-action], [data-appearance], [data-setting]');
  if (!element) return;
  if (element.dataset.appearance) {
    settings = { ...settings, appearance: element.dataset.appearance as Appearance };
    saveSettingsNow(); render(); return;
  }
  if (element.dataset.setting) {
    const setting = element.dataset.setting as 'backgroundMusic' | 'soundEffects';
    settings = { ...settings, [setting]: !settings[setting] };
    saveSettingsNow(); render(); return;
  }
  const action = element.dataset.action;
  if (action === 'play') startNewGame();
  if (action === 'continue') continueGame();
  if (action === 'settings') openSettings();
  if (action === 'credits') { screen = 'credits'; render(); }
  if (action === 'back') returnFromSettings();
  if (action === 'pause' && screen === 'game' && !busy) { screen = 'pause'; persistProgress(false); render(); }
  if (action === 'resume' && screen === 'pause') { screen = 'game'; render(); }
  if (action === 'restart' && (screen === 'game' || screen === 'pause' || screen === 'out')) startLevel(catalogEntry.number);
  if (action === 'title') { if (!busy) persistProgress(screen === 'complete'); screen = 'title'; render(); }
  if (action === 'next' && screen === 'complete') {
    const next = getNextCuratedLevel(catalogEntry);
    if (next) startLevel(next.number); else { persistProgress(true); screen = 'title'; render(); }
  }
  if (action === 'zoom-reset') {
    viewport.reset(level.width, level.height);
    const board = app.querySelector<SVGSVGElement>('.board');
    const box = viewport.viewBox;
    board?.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  }
});

app.addEventListener('keydown', (event) => {
  const arrow = (event.target as Element).closest<SVGGElement>('[data-arrow]');
  if (arrow && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (arrow.dataset.arrow) attemptMove(arrow.dataset.arrow); }
  if (event.key === 'Escape' && screen === 'game' && !busy) { screen = 'pause'; render(); }
  if (event.key === 'Escape' && screen === 'pause') { screen = 'game'; render(); }
  if (event.key === 'Escape' && screen === 'settings') returnFromSettings();
});

function applyStroke(width: number): void {
  strokeWidth = width;
  applyStrokeWidth();
}

render();
applyStrokeWidth();
if (QA_MODE) {
  void import('./qa/qaPanel').then(({ mountQAPanel }) => {
    qaPanel = mountQAPanel({
      onSpeed: (value) => { speedMultiplier = value; },
      onStroke: applyStroke,
      onDiagnostics: (value) => { diagnostics = value; if (!busy) render(); },
      inspect: inspectCurrentBoard,
      onHighlightLegal: (id) => { if (arrows.some(({ id: arrowId }) => arrowId === id)) { qaHighlightedArrowId = id; render(); } },
      onLevel: (number) => startLevel(number, true),
      onRestart: () => startLevel(catalogEntry.number, true),
      onResetQAState: () => { qaHighlightedArrowId = null; },
      candidateSha: import.meta.env.VITE_CANDIDATE_SHA,
    });
    if (screen === 'game') render();
  });
}
