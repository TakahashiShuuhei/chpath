import type { Point, Stroke } from './types';
import { dist, reverseStroke, strokeEnd, strokeStart } from './types';

/**
 * 書き順を無視し、ペンアップ移動距離が短くなるよう貪欲法でストロークを並べ替える。
 * 各ステップで、現在のペン位置から最も近い未処理ストロークの端点(始点・終点どちらでもよい)を選ぶ。
 */
export function orderStrokes(strokes: Stroke[], startPoint: Point): Stroke[] {
  const remaining = strokes.slice();
  const ordered: Stroke[] = [];
  let pen = startPoint;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestReversed = false;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const dStart = dist(pen, strokeStart(s));
      const dEnd = dist(pen, strokeEnd(s));
      if (dStart < bestDist) {
        bestDist = dStart;
        bestIdx = i;
        bestReversed = false;
      }
      if (dEnd < bestDist) {
        bestDist = dEnd;
        bestIdx = i;
        bestReversed = true;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    const stroke = bestReversed ? reverseStroke(chosen) : chosen;
    ordered.push(stroke);
    pen = strokeEnd(stroke);
  }

  return ordered;
}
