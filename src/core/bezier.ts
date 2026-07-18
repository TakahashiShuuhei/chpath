import type { Point } from './types';

export type Cubic = { from: Point; c1: Point; c2: Point; to: Point };

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function evaluateCubic(c: Cubic, t: number): Point {
  const ab = lerp(c.from, c.c1, t);
  const bc = lerp(c.c1, c.c2, t);
  const cd = lerp(c.c2, c.to, t);
  const abc = lerp(ab, bc, t);
  const bcd = lerp(bc, cd, t);
  return lerp(abc, bcd, t);
}

/** De Casteljau分割: tで2つの3次ベジエに分割する */
export function splitCubic(c: Cubic, t: number): [Cubic, Cubic] {
  const ab = lerp(c.from, c.c1, t);
  const bc = lerp(c.c1, c.c2, t);
  const cd = lerp(c.c2, c.to, t);
  const abc = lerp(ab, bc, t);
  const bcd = lerp(bc, cd, t);
  const abcd = lerp(abc, bcd, t);
  return [
    { from: c.from, c1: ab, c2: abc, to: abcd },
    { from: abcd, c1: bcd, c2: cd, to: c.to },
  ];
}

export function sampleCubic(c: Cubic, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(evaluateCubic(c, i / steps));
  }
  return pts;
}
