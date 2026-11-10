export type DiagnosticFlags = { ids: boolean; ownership: boolean; hitTargets: boolean; geometry: boolean };
export type QABoardSnapshot = {
  levelNumber: number;
  boardTitle?: string;
  remainingArrowIds: string[];
  legalArrowIds: string[];
  solution: string[] | null;
  selectedArrowId?: string;
  selectedCanEscape: boolean | null;
  collision: { blockedBy: string; travelDistance: number } | null;
  animating: boolean;
};
export type QAPanelOptions = {
  onSpeed: (multiplier: number) => void;
  onStroke: (width: number) => void;
  onDiagnostics: (flags: DiagnosticFlags) => void;
  inspect: (selectedArrowId?: string) => QABoardSnapshot;
  onHighlightLegal: (arrowId: string) => void;
  onLevel: (level: number) => void;
  onRestart: () => void;
  onResetQAState: () => void;
  prototypeCount: number;
  onPrototypeReview: () => void;
  candidateSha?: string;
};

export const SPEED_PRESETS = [1, 1.5, 2, 2.5] as const;
export const STROKE_PRESETS = [0.12, 0.15, 0.18] as const;
export const QA_DEFAULTS = { speed: 2, stroke: 0.15, diagnostics: { ids: false, ownership: false, hitTargets: false, geometry: false } };

function html(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

/** A hold must finish on the original pointer, inside the target, without drifting. */
export function bindLongPress(target: HTMLElement, open: () => void): () => void {
  let timer = 0;
  let pointerId: number | undefined;
  let origin: { x: number; y: number } | undefined;
  let fired = false;
  const cancel = () => { window.clearTimeout(timer); pointerId = undefined; origin = undefined; target.classList.remove('qa-holding'); };
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    cancel(); fired = false; pointerId = event.pointerId; origin = { x: event.clientX, y: event.clientY };
    target.classList.add('qa-holding');
    timer = window.setTimeout(() => {
      if (pointerId === event.pointerId) { fired = true; cancel(); open(); }
    }, 2000);
  };
  const move = (event: PointerEvent) => {
    if (pointerId !== event.pointerId || !origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) cancel();
  };
  const up = (event: PointerEvent) => { if (pointerId === event.pointerId) cancel(); };
  const key = (event: KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !fired) { event.preventDefault(); open(); }
  };
  const context = (event: Event) => event.preventDefault();
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
  target.addEventListener('pointerleave', up);
  target.addEventListener('keydown', key);
  target.addEventListener('contextmenu', context);
  target.addEventListener('dragstart', context);
  return () => { cancel(); target.removeEventListener('pointerdown', down); target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); target.removeEventListener('pointerleave', up); target.removeEventListener('keydown', key); target.removeEventListener('contextmenu', context); target.removeEventListener('dragstart', context); };
}

export function mountQAPanel(options: QAPanelOptions): { open: () => void; bind: typeof bindLongPress } {
  let speed = QA_DEFAULTS.speed;
  let stroke = QA_DEFAULTS.stroke;
  let diagnostics = { ...QA_DEFAULTS.diagnostics };
  let selectedArrowId: string | undefined;
  let root = document.querySelector<HTMLElement>('#qa-panel-root');
  if (!root) { root = document.createElement('div'); root.id = 'qa-panel-root'; document.body.append(root); }
  const close = () => { root!.innerHTML = ''; root!.classList.remove('open'); };

  const render = () => {
    const snapshot = options.inspect(selectedArrowId);
    selectedArrowId = snapshot.selectedArrowId;
    const legalText = snapshot.animating ? 'Wait for movement to finish before inspecting.'
      : snapshot.legalArrowIds.length > 0 ? `${snapshot.legalArrowIds.length} legal move${snapshot.legalArrowIds.length === 1 ? '' : 's'}`
        : snapshot.remainingArrowIds.length === 0 ? 'Board cleared.' : 'No legal moves: every remaining arrow is blocked. This state is a deadlock.';
    const solvableText = snapshot.animating ? 'Not checked during animation.' : snapshot.solution ? 'Solvable' : 'Unsolvable';
    const collisionText = snapshot.animating ? 'Movement currently in progress.'
      : snapshot.selectedCanEscape === true ? 'Selected arrow can escape now.'
        : snapshot.collision ? `Blocked by ${html(snapshot.collision.blockedBy)} after ${snapshot.collision.travelDistance.toFixed(2)} cells.`
          : 'No arrow selected.';
    root!.classList.add('open');
    root!.innerHTML = `<div class="qa-backdrop" data-qa-close><section class="qa-panel" role="dialog" aria-modal="true" aria-labelledby="qa-title">
      <header><div><span class="qa-kicker">ARROW ADVENTURE</span><h2 id="qa-title">QA settings</h2></div><button type="button" class="qa-close" data-qa-close aria-label="Close QA settings">×</button></header>
      <section class="qa-live-state" aria-live="polite"><div class="qa-state-top"><b>${html(snapshot.boardTitle ?? `Level ${snapshot.levelNumber}`)}</b><span>${solvableText}</span></div><p class="qa-state-legal">${legalText}</p>
        <p><b>Remaining IDs</b><br><code>${snapshot.remainingArrowIds.map(html).join(', ') || 'none'}</code></p>
        <p><b>Solver route</b><br><code>${snapshot.animating ? '—' : snapshot.solution?.map(html).join(' → ') ?? 'none'}</code></p>
        <label class="qa-select-label" for="qa-arrow-select">Collision check</label><select id="qa-arrow-select" data-inspect-select ${snapshot.remainingArrowIds.length ? '' : 'disabled'}>${snapshot.remainingArrowIds.map((id) => `<option value="${html(id)}" ${id === snapshot.selectedArrowId ? 'selected' : ''}>${html(id)}</option>`).join('')}</select>
        <p class="qa-collision-info">${collisionText}</p>
        <button type="button" data-highlight ${snapshot.legalArrowIds.length && !snapshot.animating ? '' : 'disabled'}>Highlight one legal arrow</button>
      </section>
      <fieldset class="qa-prototype-tools"><legend>Prototype testing</legend><button type="button" class="qa-prototype-review" data-prototype-review ${snapshot.animating ? 'disabled' : ''}>Prototype Review <span>${options.prototypeCount} puzzles</span></button></fieldset>
      <fieldset><legend>Animation speed</legend><div class="qa-options">${SPEED_PRESETS.map((value) => `<button type="button" data-speed="${value}" aria-pressed="${value === speed}">${value}×</button>`).join('')}</div></fieldset>
      <fieldset><legend>Arrow thickness</legend><div class="qa-options">${STROKE_PRESETS.map((value, index) => `<button type="button" data-stroke="${value}" aria-pressed="${value === stroke}">${['Thin', 'Medium', 'Bold'][index]}</button>`).join('')}</div></fieldset>
      <fieldset><legend>Geometry diagnostics</legend>${[['ids','Arrow IDs'],['ownership','Path ownership'],['hitTargets','Hit targets'],['geometry','Board geometry']].map(([key,label]) => `<label class="qa-toggle"><span>${label}</span><input type="checkbox" data-diagnostic="${key}" ${diagnostics[key as keyof DiagnosticFlags] ? 'checked' : ''}></label>`).join('')}</fieldset>
      <fieldset><legend>Jump to level</legend><div class="qa-levels">${[1,2,3,4,5,6].map((value) => `<button type="button" data-level="${value}">Level ${value}</button>`).join('')}</div></fieldset>
      <div class="qa-actions"><button type="button" data-restart>Restart current level</button><button type="button" data-reset>Reset QA state</button></div>
      <p class="qa-commit">Candidate <code>${html(options.candidateSha || 'local development build')}</code></p>
    </section></div>`;
  };
  const open = () => { selectedArrowId = undefined; render(); };

  root.addEventListener('pointerdown', (event) => { if ((event.target as Element).matches('.qa-backdrop')) close(); });
  root.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-qa-close], [data-speed], [data-stroke], [data-level], [data-restart], [data-reset], [data-highlight], [data-prototype-review]');
    if (!target) return;
    if (target.hasAttribute('data-qa-close')) close();
    if (target.hasAttribute('data-prototype-review') && !target.hasAttribute('disabled')) { close(); options.onPrototypeReview(); return; }
    if (target.dataset.speed) { speed = Number(target.dataset.speed); options.onSpeed(speed); render(); }
    if (target.dataset.stroke) { stroke = Number(target.dataset.stroke); options.onStroke(stroke); render(); }
    if (target.dataset.level) { options.onLevel(Number(target.dataset.level)); close(); }
    if (target.hasAttribute('data-restart')) { options.onRestart(); close(); }
    if (target.hasAttribute('data-reset')) { speed = QA_DEFAULTS.speed; stroke = QA_DEFAULTS.stroke; diagnostics = { ...QA_DEFAULTS.diagnostics }; selectedArrowId = undefined; options.onSpeed(speed); options.onStroke(stroke); options.onDiagnostics({ ...diagnostics }); options.onResetQAState(); render(); }
    if (target.hasAttribute('data-highlight')) {
      const safeArrow = options.inspect(selectedArrowId).legalArrowIds[0];
      if (safeArrow) { options.onHighlightLegal(safeArrow); close(); }
    }
  });
  root.addEventListener('change', (event) => {
    const target = event.target as Element;
    const select = target.closest<HTMLSelectElement>('[data-inspect-select]');
    if (select) { selectedArrowId = select.value || undefined; render(); return; }
    const input = target.closest<HTMLInputElement>('[data-diagnostic]');
    if (!input) return;
    diagnostics = { ...diagnostics, [input.dataset.diagnostic!]: input.checked };
    options.onDiagnostics({ ...diagnostics });
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && root!.classList.contains('open')) close(); });
  return { open, bind: bindLongPress };
}
