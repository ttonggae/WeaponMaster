import type { Segment, Vec2 } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function lerpAngle(a: number, b: number, t: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * clamp(t, 0, 1);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(a: Vec2, amount: number): Vec2 {
  return { x: a.x * amount, y: a.y * amount };
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  const x = clamp(t, 0, 1);
  return {
    x: lerp(a.x, b.x, x),
    y: lerp(a.y, b.y, x),
  };
}

export function pointSegmentDistance(point: Vec2, segment: Segment): number {
  const vx = segment.end.x - segment.start.x;
  const vy = segment.end.y - segment.start.y;
  const wx = point.x - segment.start.x;
  const wy = point.y - segment.start.y;
  const lengthSquared = vx * vx + vy * vy;
  if (lengthSquared <= 0.0001) {
    return distance(point, segment.start);
  }
  const t = clamp((wx * vx + wy * vy) / lengthSquared, 0, 1);
  return distance(point, {
    x: segment.start.x + vx * t,
    y: segment.start.y + vy * t,
  });
}

export function segmentSegmentDistance(a: Segment, b: Segment): number {
  if (segmentsIntersect(a.start, a.end, b.start, b.end)) {
    return 0;
  }
  return Math.min(
    pointSegmentDistance(a.start, b),
    pointSegmentDistance(a.end, b),
    pointSegmentDistance(b.start, a),
    pointSegmentDistance(b.end, a),
  );
}

export function capsulesOverlap(a: Segment, b: Segment): boolean {
  return segmentSegmentDistance(a, b) <= a.radius + b.radius;
}

export function segmentMidpoint(segment: Segment): Vec2 {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }
  return (
    (o1 === 0 && onSegment(a, c, b)) ||
    (o2 === 0 && onSegment(a, d, b)) ||
    (o3 === 0 && onSegment(c, a, d)) ||
    (o4 === 0 && onSegment(c, b, d))
  );
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.00001) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function onSegment(a: Vec2, b: Vec2, c: Vec2): boolean {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}
