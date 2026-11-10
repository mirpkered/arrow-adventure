import { describe, expect, it } from 'vitest';
import { arrowCompositionBounds, BoardViewport } from '../src/app/viewport';

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

  it('fits the actual occupied arrows, including arrowheads and tails, rather than the logical board rectangle', () => {
    const arrows = [{ id: 'short', path: [{ x: 8, y: 8 }, { x: 9, y: 8 }] }];
    const bounds = arrowCompositionBounds(arrows)!;
    expect(bounds.minX).toBeLessThan(8.5);
    expect(bounds.maxX).toBeGreaterThan(9.86);
    expect(bounds.minY).toBeLessThan(8.5);

    const viewport = new BoardViewport(24, 24);
    viewport.fitToContent(bounds, 390, 844);
    expect(viewport.scale).toBe(1);
    expect(viewport.viewBox.height).toBeLessThan(6);
    expect(viewport.viewBox.width / viewport.viewBox.height).toBeCloseTo(390 / 844, 6);
    expect(viewport.viewBox.x).toBeLessThan(bounds.minX);
    expect(viewport.viewBox.x + viewport.viewBox.width).toBeGreaterThan(bounds.maxX);
    expect(viewport.viewBox.y).toBeLessThan(bounds.minY);
    expect(viewport.viewBox.y + viewport.viewBox.height).toBeGreaterThan(bounds.maxY);
  });

  it('fits large boards completely, preserves zoom across orientation resizing, and restores the fitted frame', () => {
    const bounds = { minX: 0, minY: 0, maxX: 20, maxY: 14 };
    const viewport = new BoardViewport(20, 15);
    viewport.fitToContent(bounds, 390, 844);
    const initial = viewport.viewBox;
    expect(initial.x).toBeLessThan(0);
    expect(initial.x + initial.width).toBeGreaterThan(20);
    expect(initial.y).toBeLessThan(0);
    expect(initial.y + initial.height).toBeGreaterThan(14);
    viewport.zoomAt(2, { x: 10, y: 7 });
    const zoom = viewport.scale;
    viewport.fitToContent(bounds, 844, 390, 0.12, true);
    expect(viewport.scale).toBeCloseTo(zoom, 6);
    viewport.restoreFit();
    expect(viewport.scale).toBe(1);
    expect(viewport.viewBox.width).toBeGreaterThan(initial.width);
  });
});
