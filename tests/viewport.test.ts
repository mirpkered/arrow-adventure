import { describe, expect, it } from 'vitest';
import { BoardViewport } from '../src/app/viewport';

describe('board zoom and pan', () => {
  it('starts fitted and restores the default view without changing puzzle geometry', () => {
    const viewport = new BoardViewport(9, 9);
    expect(viewport.scale).toBe(1);
    expect(viewport.viewBox).toEqual({ x: -0.5, y: -0.5, width: 10, height: 10 });
    viewport.zoomAt(2, { x: 4.5, y: 4.5 });
    viewport.reset();
    expect(viewport.scale).toBe(1);
  });

  it('zooms about the finger focus, supports panning, and keeps part of the board reachable', () => {
    const viewport = new BoardViewport(20, 10);
    viewport.zoomAt(2, { x: 10, y: 5 });
    expect(viewport.scale).toBe(2);
    expect(viewport.viewBox.x + viewport.viewBox.width / 2).toBeCloseTo(10);
    viewport.panBy(2, 1);
    expect(viewport.viewBox.x).toBeCloseTo(2.75);
    expect(viewport.viewBox.y).toBeCloseTo(1.25);
    viewport.panBy(1000, 1000);
    expect(viewport.viewBox.x + viewport.viewBox.width).toBeGreaterThan(0.1);
    expect(viewport.viewBox.y + viewport.viewBox.height).toBeGreaterThan(0.1);
  });

  it('clamps zoom-out at fit and zoom-in to a practical maximum', () => {
    const viewport = new BoardViewport(12, 10);
    viewport.zoomAt(0.1, { x: 6, y: 5 });
    expect(viewport.scale).toBe(1);
    viewport.zoomAt(100, { x: 6, y: 5 });
    expect(viewport.scale).toBe(4.5);
  });
});
