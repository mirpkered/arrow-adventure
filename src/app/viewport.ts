import type { Point } from '../game/types';

export type BoardViewBox = { x: number; y: number; width: number; height: number };

/** A bounded viewBox controller: fitted at 1×, pinch-zoomable and pannable without losing the board. */
export class BoardViewport {
  private base: BoardViewBox;
  private current: BoardViewBox;
  private boardWidth = 1;
  private boardHeight = 1;

  constructor(width: number, height: number) {
    this.base = { x: -0.5, y: -0.5, width: width + 1, height: height + 1 };
    this.current = { ...this.base };
    this.boardWidth = width;
    this.boardHeight = height;
  }

  get viewBox(): BoardViewBox { return { ...this.current }; }
  get scale(): number { return this.base.width / this.current.width; }

  reset(width = this.boardWidth, height = this.boardHeight): void {
    this.boardWidth = width;
    this.boardHeight = height;
    this.base = { x: -0.5, y: -0.5, width: width + 1, height: height + 1 };
    this.current = { ...this.base };
  }

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
    const boardMinX = -0.5; const boardMinY = -0.5;
    const boardMaxX = this.boardWidth + 0.5; const boardMaxY = this.boardHeight + 0.5;
    const visibleFraction = 0.15;
    this.current.x = Math.max(boardMinX - this.current.width * (1 - visibleFraction), Math.min(boardMaxX - this.current.width * visibleFraction, this.current.x));
    this.current.y = Math.max(boardMinY - this.current.height * (1 - visibleFraction), Math.min(boardMaxY - this.current.height * visibleFraction, this.current.y));
  }
}
