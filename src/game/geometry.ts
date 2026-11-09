import type { Arrow, Point } from './types';

/** Default visible SVG body stroke width in board-cell units. */
export const ARROW_STROKE_WIDTH = 0.15;
/** Gameplay collision geometry is fixed to the widest approved art preset. */
export const ARROW_COLLISION_WIDTH = 0.18;
export const ARROW_MAX_RENDERED_WIDTH = 0.18;
/** Floating point slack used at exact contacts; it is far smaller than a pixel at board scale. */
export const GEOMETRY_EPSILON = 1e-8;
const HEAD_STROKE_WIDTH = 0.036;

type Segment = { a: Point; b: Point };

export function arrowHeadTriangle(path: Point[], strokeWidth = ARROW_STROKE_WIDTH): [Point, Point, Point] {
  const head = path.at(-1);
  const previous = path.at(-2);
  if (!head || !previous) throw new Error('An arrow head needs a preceding path point');
  const dx = head.x - previous.x;
  const dy = head.y - previous.y;
  const length = Math.hypot(dx, dy);
  if (!length) throw new Error('An arrow head needs a nonzero direction');
  const direction = { x: dx / length, y: dy / length };
  const perpendicular = { x: -direction.y, y: direction.x };
  const center = { x: head.x + 0.5, y: head.y + 0.5 };
  const scale = strokeWidth / ARROW_STROKE_WIDTH;
  const tip = { x: center.x + direction.x * 0.36 * scale, y: center.y + direction.y * 0.36 * scale };
  const base = { x: center.x + direction.x * 0.07 * scale, y: center.y + direction.y * 0.07 * scale };
  return [
    tip,
    { x: base.x + perpendicular.x * 0.17 * scale, y: base.y + perpendicular.y * 0.17 * scale },
    { x: base.x - perpendicular.x * 0.17 * scale, y: base.y - perpendicular.y * 0.17 * scale },
  ];
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(point: Point, segment: Segment): boolean {
  return Math.abs(cross(segment.a, segment.b, point)) <= GEOMETRY_EPSILON
    && point.x >= Math.min(segment.a.x, segment.b.x) - GEOMETRY_EPSILON
    && point.x <= Math.max(segment.a.x, segment.b.x) + GEOMETRY_EPSILON
    && point.y >= Math.min(segment.a.y, segment.b.y) - GEOMETRY_EPSILON
    && point.y <= Math.max(segment.a.y, segment.b.y) + GEOMETRY_EPSILON;
}

function segmentsIntersect(left: Segment, right: Segment): boolean {
  const a = cross(left.a, left.b, right.a);
  const b = cross(left.a, left.b, right.b);
  const c = cross(right.a, right.b, left.a);
  const d = cross(right.a, right.b, left.b);
  if (((a > GEOMETRY_EPSILON && b < -GEOMETRY_EPSILON) || (a < -GEOMETRY_EPSILON && b > GEOMETRY_EPSILON))
    && ((c > GEOMETRY_EPSILON && d < -GEOMETRY_EPSILON) || (c < -GEOMETRY_EPSILON && d > GEOMETRY_EPSILON))) return true;
  return (Math.abs(a) <= GEOMETRY_EPSILON && onSegment(right.a, left))
    || (Math.abs(b) <= GEOMETRY_EPSILON && onSegment(right.b, left))
    || (Math.abs(c) <= GEOMETRY_EPSILON && onSegment(left.a, right))
    || (Math.abs(d) <= GEOMETRY_EPSILON && onSegment(left.b, right));
}

function pointSegmentDistance(point: Point, segment: Segment): number {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) return Math.hypot(point.x - segment.a.x, point.y - segment.a.y);
  const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (segment.a.x + t * dx), point.y - (segment.a.y + t * dy));
}

export function segmentDistance(left: Segment, right: Segment): number {
  if (segmentsIntersect(left, right)) return 0;
  return Math.min(
    pointSegmentDistance(left.a, right),
    pointSegmentDistance(left.b, right),
    pointSegmentDistance(right.a, left),
    pointSegmentDistance(right.b, left),
  );
}

export function pointToPolylineDistance(point: Point, path: Point[]): number {
  const centerline = cellCenters(path);
  return Math.min(...segments(centerline).map((segment) => pointSegmentDistance(point, segment)));
}

function segments(points: Point[]): Segment[] {
  return points.slice(1).map((point, index) => ({ a: points[index], b: point }));
}

function cellCenters(points: Point[]): Point[] {
  return points.map((point) => ({ x: point.x + 0.5, y: point.y + 0.5 }));
}

export function polylinesCollide(left: Point[], right: Point[], distance = ARROW_STROKE_WIDTH): boolean {
  const leftSegments = segments(cellCenters(left));
  const rightSegments = segments(cellCenters(right));
  return leftSegments.some((a) => rightSegments.some((b) => segmentDistance(a, b) <= distance + GEOMETRY_EPSILON));
}

export type SelfClearanceIssue = {
  type: 'body-clearance' | 'head-clearance';
  segmentAIndex: number;
  segmentBIndex?: number;
  clearance: number;
  threshold: number;
  point: Point;
};

/** Finds nonadjacent body segments that violate the fixed gameplay clearance. */
export function findSelfBodyClearanceIssue(path: Point[], extraClearance = 0): SelfClearanceIssue | undefined {
  const body = segments(cellCenters(path));
  const threshold = ARROW_COLLISION_WIDTH + extraClearance;
  let nearest: SelfClearanceIssue | undefined;
  for (let left = 0; left < body.length; left += 1) for (let right = left + 2; right < body.length; right += 1) {
    const clearance = segmentDistance(body[left], body[right]);
    if (clearance <= threshold + GEOMETRY_EPSILON && (!nearest || clearance < nearest.clearance)) {
      nearest = {
        type: 'body-clearance',
        segmentAIndex: left,
        segmentBIndex: right,
        clearance,
        threshold,
        point: { x: (body[left].a.x + body[left].b.x) / 2, y: (body[left].a.y + body[left].b.y) / 2 },
      };
    }
  }
  return nearest;
}

/** Checks the arrowhead against all of its own body except the attached final segment. */
export function findSelfHeadClearanceIssue(path: Point[], extraClearance = 0): SelfClearanceIssue | undefined {
  if (path.length < 3) return undefined;
  const head = arrowHeadTriangle(path, ARROW_MAX_RENDERED_WIDTH);
  const headEdges = segments([...head, head[0]]);
  const body = segments(cellCenters(path.slice(0, -1)));
  const threshold = ARROW_COLLISION_WIDTH / 2 + HEAD_STROKE_WIDTH / 2 + extraClearance;
  let nearest: SelfClearanceIssue | undefined;
  for (let index = 0; index < body.length; index += 1) {
    const line = body[index];
    const clearance = pointInPolygon(line.a, head) || pointInPolygon(line.b, head)
      ? 0 : Math.min(...headEdges.map((edge) => segmentDistance(line, edge)));
    if (clearance <= threshold + GEOMETRY_EPSILON && (!nearest || clearance < nearest.clearance)) {
      nearest = { type: 'head-clearance', segmentAIndex: index, clearance, threshold, point: line.a };
    }
  }
  return nearest;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const edge = { a: polygon[j], b: polygon[i] };
    if (onSegment(point, edge)) return true;
    const intersects = (polygon[i].y > point.y) !== (polygon[j].y > point.y)
      && point.x < ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) / (polygon[j].y - polygon[i].y) + polygon[i].x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polylineHitsPolygon(path: Point[], polygon: Point[]): boolean {
  const tolerance = ARROW_COLLISION_WIDTH / 2 + HEAD_STROKE_WIDTH / 2;
  const polygonEdges = segments([...polygon, polygon[0]]);
  return segments(cellCenters(path)).some((line) => pointInPolygon(line.a, polygon)
    || pointInPolygon(line.b, polygon)
    || polygonEdges.some((edge) => segmentDistance(line, edge) <= tolerance + GEOMETRY_EPSILON));
}

function polygonsCollide(left: Point[], right: Point[], clearance = 0): boolean {
  if (pointInPolygon(left[0], right) || pointInPolygon(right[0], left)) return true;
  const leftEdges = segments([...left, left[0]]);
  const rightEdges = segments([...right, right[0]]);
  const tolerance = HEAD_STROKE_WIDTH + clearance + GEOMETRY_EPSILON;
  return leftEdges.some((a) => rightEdges.some((b) => segmentDistance(a, b) <= tolerance));
}

/** Matches visible arrow bodies and triangular heads, not just occupied grid points. */
export function arrowsCollide(left: Arrow, right: Arrow, extraClearance = 0): boolean {
  if (polylinesCollide(left.path, right.path, ARROW_COLLISION_WIDTH + extraClearance)) return true;
  const leftHead = arrowHeadTriangle(left.path, ARROW_MAX_RENDERED_WIDTH);
  const rightHead = arrowHeadTriangle(right.path, ARROW_MAX_RENDERED_WIDTH);
  if (extraClearance > 0) {
    // Expand the body/head contact tolerances by the maximum travel between
    // collision samples. This makes the sampled sweep conservative.
    return polylinesCollide(left.path, right.path, ARROW_COLLISION_WIDTH + extraClearance)
      || sweptHeadBodyContact(left.path, rightHead, extraClearance)
      || sweptHeadBodyContact(right.path, leftHead, extraClearance)
      || polygonsCollide(leftHead, rightHead, extraClearance);
  }
  return polylineHitsPolygon(left.path, rightHead)
    || polylineHitsPolygon(right.path, leftHead)
    || polygonsCollide(leftHead, rightHead);
}

function sweptHeadBodyContact(path: Point[], polygon: Point[], extraClearance: number): boolean {
  const polygonEdges = segments([...polygon, polygon[0]]);
  const tolerance = ARROW_COLLISION_WIDTH / 2 + HEAD_STROKE_WIDTH / 2 + extraClearance;
  return segments(cellCenters(path)).some((line) => pointInPolygon(line.a, polygon)
    || pointInPolygon(line.b, polygon)
    || polygonEdges.some((edge) => segmentDistance(line, edge) <= tolerance + GEOMETRY_EPSILON));
}
