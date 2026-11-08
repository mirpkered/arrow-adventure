import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { mountQAPanel, type QABoardSnapshot } from '../src/qa/qaPanel';

const sampleSnapshot = (selectedArrowId = 'a01'): QABoardSnapshot => ({
  levelNumber: 4,
  remainingArrowIds: ['a01', 'a02', 'a03'],
  legalArrowIds: ['a02'],
  solution: ['a02', 'a03', 'a01'],
  selectedArrowId,
  selectedCanEscape: selectedArrowId === 'a02',
  collision: selectedArrowId === 'a02' ? null : { blockedBy: 'a02', travelDistance: 1.25 },
  animating: false,
});

describe('QA board diagnostics', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the actual board state and collision result without activating game controls', () => {
    const dom = new Window();
    vi.stubGlobal('document', dom.document);
    const inspect = vi.fn((id?: string) => sampleSnapshot(id));
    const onLevel = vi.fn(); const onRestart = vi.fn(); const onHighlightLegal = vi.fn();
    const panel = mountQAPanel({
      onSpeed: vi.fn(), onStroke: vi.fn(), onDiagnostics: vi.fn(), inspect, onHighlightLegal,
      onLevel, onRestart, onResetQAState: vi.fn(), candidateSha: 'abc123',
    });
    panel.open();
    const root = dom.document.querySelector('#qa-panel-root') as unknown as HTMLElement;
    expect(root.textContent).toContain('1 legal move');
    expect(root.textContent).toContain('Remaining IDs');
    expect(root.textContent).toContain('a01, a02, a03');
    expect(root.textContent).toContain('Solvable');
    expect(root.textContent).toContain('Blocked by a02 after 1.25 cells.');
    expect(root.textContent).toContain('abc123');
    expect(inspect).toHaveBeenCalled();
    expect(onLevel).not.toHaveBeenCalled(); expect(onRestart).not.toHaveBeenCalled();
    (root.querySelector('[data-highlight]') as unknown as HTMLButtonElement).click();
    expect(onHighlightLegal).toHaveBeenCalledTimes(1);
    expect(onHighlightLegal).toHaveBeenCalledWith('a02');
    expect(root.classList.contains('open')).toBe(false);
    expect(onLevel).not.toHaveBeenCalled(); expect(onRestart).not.toHaveBeenCalled();
    dom.close();
  });

  it('refreshes collision diagnostics for a selected arrow and marks deadlocks explicitly', () => {
    const dom = new Window();
    vi.stubGlobal('document', dom.document);
    const inspect = vi.fn((id?: string) => id === 'a02'
      ? { ...sampleSnapshot('a02'), legalArrowIds: [], solution: null }
      : { ...sampleSnapshot(id), legalArrowIds: [], solution: null });
    const panel = mountQAPanel({ onSpeed: vi.fn(), onStroke: vi.fn(), onDiagnostics: vi.fn(), inspect,
      onHighlightLegal: vi.fn(), onLevel: vi.fn(), onRestart: vi.fn(), onResetQAState: vi.fn() });
    panel.open();
    const root = dom.document.querySelector('#qa-panel-root') as unknown as HTMLElement;
    expect(root.textContent).toContain('No legal moves: every remaining arrow is blocked. This state is a deadlock.');
    const select = root.querySelector('[data-inspect-select]') as unknown as HTMLSelectElement;
    select.value = 'a02';
    select.dispatchEvent(new dom.Event('change', { bubbles: true }) as unknown as Event);
    expect(inspect).toHaveBeenLastCalledWith('a02');
    expect(root.textContent).toContain('Selected arrow can escape now.');
    dom.close();
  });

  it('keeps level jumps, restart, and temporary reset in QA callbacks only', () => {
    const dom = new Window();
    vi.stubGlobal('document', dom.document);
    const onLevel = vi.fn(); const onRestart = vi.fn(); const onResetQAState = vi.fn();
    const panel = mountQAPanel({ onSpeed: vi.fn(), onStroke: vi.fn(), onDiagnostics: vi.fn(), inspect: () => sampleSnapshot(),
      onHighlightLegal: vi.fn(), onLevel, onRestart, onResetQAState });
    panel.open();
    const root = dom.document.querySelector('#qa-panel-root') as unknown as HTMLElement;
    (root.querySelector('[data-level="4"]') as unknown as HTMLButtonElement).click();
    expect(onLevel).toHaveBeenCalledWith(4);
    expect(onRestart).not.toHaveBeenCalled();
    panel.open();
    const qaRoot = dom.document.querySelector('#qa-panel-root') as unknown as HTMLElement;
    (qaRoot.querySelector('[data-restart]') as unknown as HTMLButtonElement).click();
    expect(onRestart).toHaveBeenCalledTimes(1);
    panel.open();
    const resetRoot = dom.document.querySelector('#qa-panel-root') as unknown as HTMLElement;
    (resetRoot.querySelector('[data-reset]') as unknown as HTMLButtonElement).click();
    expect(onResetQAState).toHaveBeenCalledTimes(1);
    expect(onLevel).toHaveBeenCalledTimes(1);
    dom.close();
  });
});
