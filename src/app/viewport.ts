import { ARROW_HEAD_WIDTH, ARROW_STROKE_WIDTH, arrowHeadTriangle, toBoardPoint } from '../game/geometry';
import type { Arrow, Point } from '../game/types';

export type BoardViewBox = { x: number; y: number; width: number; height: number };
export type BoardBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Includes path strokes, the complete head triangle, and the tail marker. */
export function arrowCompositionBounds(arrows: Arrow[], pathOffset = 0.5): BoardBounds | undefined {
  if (arrows.length === 0) return undefined;
  const points: Point[] = [];
  for (const arrow of arrows) {
    points.push(...arrow.path.map((point) => toBoardPoint(point, pathOffset)), ...arrowHeadTriangle(arrow.path, ARROW_HEAD_WIDTH, pathOffset));
    const tail = toBoardPoint(arrow.path[0], pathOffset);
    points.push({ x: tail.x - 0.09, y: tail.y - 0.09 }, { x: tail.x + 0.09, y: tail.y + 0.09 });
  }
  const padding = Math.max(ARROW_STROKE_WIDTH / 2, ARROW_HEAD_WIDTH * 0.025);
  return {
    minX: Math.min(...points.map(({ x }) => x)) - padding,
    minY: Math.min(...points.map(({ y }) => y)) - padding,
    maxX: Math.max(...points.map(({ x }) => x)) + padding,
    maxY: Math.max(...points.map(({ y }) => y)) + padding,
  };
}

/** Fits the actual arrow composition to the available viewport, then supports bounded zoom and pan. */
export class BoardViewport {
  private base: BoardViewBox;
  private current: BoardViewBox;
  private boardWidth = 1;
  private boardHeight = 1;
  private bounds: BoardBounds;

  constructor(width: number, height: number) {
    this.base = { x: -0.5, y: -0.5, width: width + 1, height: height + 1 };
    this.current = { ...this.base };
    this.boardWidth = width;
    this.boardHeight = height;
    this.bounds = { minX: -0.5, minY: -0.5, maxX: width + 0.5, maxY: height + 0.5 };
  }

  get viewBox(): BoardViewBox { return { ...this.current }; }
  get scale(): number { return this.base.width / this.current.width; }

  reset(width = this.boardWidth, height = this.boardHeight): void {
    this.boardWidth = width;
    this.boardHeight = height;
    this.bounds = { minX: -0.5, minY: -0.5, maxX: width + 0.5, maxY: height + 0.5 };
    this.base = { x: -0.5, y: -0.5, width: width + 1, height: height + 1 };
    this.current = { ...this.base };
  }

  /**
   * Calculates a viewBox with the same aspect ratio as the actual SVG viewport.
   * `padding` is a fraction on each side of the occupied composition. When
   * `preserveZoom` is true, a screen resize keeps the user's approximate zoom
   * and center while updating the underlying fitted frame.
   */
  fitToContent(bounds: BoardBounds | undefined, pixelWidth: number, pixelHeight: number, padding = 0.12, preserveZoom = false): void {
    if (!Number.isFinite(pixelWidth) || !Number.isFinite(pixelHeight) || pixelWidth <= 0 || pixelHeight <= 0) return;
    const oldScale = this.scale;
    const oldCenter = { x: this.current.x + this.current.width / 2, y: this.current.y + this.current.height / 2 };
    this.bounds = bounds && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY
      ? { ...bounds }
      : { minX: -0.5, minY: -0.5, maxX: this.boardWidth + 0.5, maxY: this.boardHeight + 0.5 };
    const contentWidth = this.bounds.maxX - this.bounds.minX;
    const contentHeight = this.bounds.maxY - this.bounds.minY;
    const safePadding = Math.max(0, Math.min(0.4, padding));
    const paddedWidth = contentWidth * (1 + 2 * safePadding);
    const paddedHeight = contentHeight * (1 + 2 * safePadding);
    const aspect = pixelWidth / pixelHeight;
    const width = Math.max(paddedWidth, paddedHeight * aspect);
    const height = width / aspect;
    const centerX = (this.bounds.minX + this.bounds.maxX) / 2;
    const centerY = (this.bounds.minY + this.bounds.maxY) / 2;
    this.base = { x: centerX - width / 2, y: centerY - height / 2, width, height };
    if (preserveZoom && oldScale > 1.001) {
      const scale = Math.max(1, Math.min(4.5, oldScale));
      this.current = {
        x: oldCenter.x - width / scale / 2,
        y: oldCenter.y - height / scale / 2,
        width: width / scale,
        height: height / scale,
      };
      this.clamp();
    } else this.current = { ...this.base };
  }

  restoreFit(): void { this.current = { ...this.base }; }

  zoomAt(factor: number, focalPoint: Point): void {
    const nextScale = Math.max(1, Math.min(4.5, this.scale * factor));
    if (nextScale <= 1.001) { this.current = { ...this.base }; return; }
    const width = this.base.width / nextScale;
    const height = this.base.height / nextScale;
    const ratioX = (focalPoint.x - this.current.x) / this.current.width;
    const ratioY = (focalPoint.y - this.current.y) / this.current.height;
    this.current = {
      x: focalPoint.x - ratioX * width,
      y: focalPoint.y - ratioY * height,
      width,
      height,
    };
    this.clamp();
  }

  panBy(worldX: number, worldY: number): void {
    if (this.scale <= 1.001) return;
    this.current.x -= worldX;
    this.current.y -= worldY;
    this.clamp();
  }

  private clamp(): void {
    const visibleFraction = 0.15;
    const clampAxis = (position: number, size: number, min: number, max: number): number => {
      const lower = min - size * (1 - visibleFraction);
      const upper = max - size * visibleFraction;
      if (lower > upper) return (min + max - size) / 2;
      return Math.max(lower, Math.min(upper, position));
    };
    this.current.x = clampAxis(this.current.x, this.current.width, this.bounds.minX, this.bounds.maxX);
    this.current.y = clampAxis(this.current.y, this.current.height, this.bounds.minY, this.bounds.maxY);
  }
}
