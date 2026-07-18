import type { Glyph, Point, Stroke } from './types';
import { dist, strokeEnd, strokeStart } from './types';
import { orderStrokes } from './orderStrokes';
import { transformStroke } from './transform';

export type Travel = { from: Point; to: Point };
export type Missing = { char: string; x: number; y: number; size: number };

export type LayoutResult = {
  strokes: Stroke[];
  travels: Travel[];
  missing: Missing[];
  width: number;
  height: number;
};

const MIN_TRAVEL = 1e-3;

export function layoutText(
  text: string,
  glyphs: Map<string, Glyph>,
  fontSize: number,
  lineHeight: number = fontSize * 1.6,
): LayoutResult {
  const scale = fontSize / 1000;
  const marginX = fontSize * 0.5;
  const marginY = fontSize * 1.2;

  let x = marginX;
  let y = marginY;
  let maxX = marginX;

  const strokes: Stroke[] = [];
  const travels: Travel[] = [];
  const missing: Missing[] = [];
  let pen: Point | null = null;

  for (const ch of text) {
    if (ch === '\n') {
      x = marginX;
      y += lineHeight;
      continue;
    }

    const glyph = glyphs.get(ch);
    if (!glyph) {
      if (ch !== ' ') missing.push({ char: ch, x, y, size: fontSize });
      x += fontSize * 0.6;
      maxX = Math.max(maxX, x);
      continue;
    }

    const placed = glyph.strokes.map((s) => transformStroke(s, scale, x, y));
    const ordered = orderStrokes(placed, pen ?? (placed[0] ? strokeStart(placed[0]) : { x, y }));

    for (const stroke of ordered) {
      if (pen) {
        const d = dist(pen, strokeStart(stroke));
        if (d > MIN_TRAVEL) travels.push({ from: pen, to: strokeStart(stroke) });
      }
      strokes.push(stroke);
      pen = strokeEnd(stroke);
    }

    x += glyph.advance * scale;
    maxX = Math.max(maxX, x);
  }

  return {
    strokes,
    travels,
    missing,
    width: maxX + marginX,
    height: y + fontSize * 0.6,
  };
}
