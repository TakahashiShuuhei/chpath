import { describe, expect, it } from 'vitest';
import { orderStrokes } from './orderStrokes';
import { segEnd, segStart, type Stroke } from './types';

describe('orderStrokes', () => {
  describe('前提: 現在のペン位置から異なる距離にある複数の独立したストロークがある場合', () => {
    const near: Stroke = [{ type: 'line', from: { x: 0, y: 0 }, to: { x: 10, y: 0 } }];
    const far: Stroke = [{ type: 'line', from: { x: 100, y: 100 }, to: { x: 110, y: 100 } }];

    it('操作: ペン位置(0,0)からorderStrokesする / 期待: 最も近い端点を持つストロークが先に選ばれる', () => {
      const ordered = orderStrokes([far, near], { x: 0, y: 0 });
      expect(ordered[0]).toEqual(near);
      expect(ordered[1]).toEqual(far);
    });
  });

  describe('前提: ストロークの終点側の方が始点側より現在位置に近い場合', () => {
    it('操作: orderStrokesする / 期待: ストロークが反転され、元の終点側から描き始めるようになる', () => {
      const stroke: Stroke = [{ type: 'line', from: { x: 100, y: 0 }, to: { x: 1, y: 0 } }];
      const [ordered] = orderStrokes([stroke], { x: 0, y: 0 });
      expect(ordered).toEqual([{ type: 'line', from: { x: 1, y: 0 }, to: { x: 100, y: 0 } }]);
    });
  });

  describe('前提: ストロークが3本以上ある場合', () => {
    it('期待: 個数・内容は変わらず、順序だけが並べ替えられて全て結果に含まれる', () => {
      const strokes: Stroke[] = [
        [{ type: 'line', from: { x: 50, y: 50 }, to: { x: 51, y: 50 } }],
        [{ type: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
        [{ type: 'line', from: { x: 20, y: 20 }, to: { x: 21, y: 20 } }],
      ];
      const ordered = orderStrokes(strokes, { x: 0, y: 0 });
      expect(ordered).toHaveLength(strokes.length);
      // 反転されている可能性があるため、始点・終点の集合が保たれているかで比較する
      const toKeys = (s: (typeof strokes)[number][number]) => {
        const a = segStart(s);
        const b = segEnd(s);
        return [`${a.x},${a.y}`, `${b.x},${b.y}`];
      };
      const originalPoints = new Set(strokes.flat().flatMap(toKeys));
      const orderedPoints = new Set(ordered.flat().flatMap(toKeys));
      expect(orderedPoints).toEqual(originalPoints);
    });
  });

  it('前提: ストロークが空配列の場合 / 期待: 空配列を返す', () => {
    expect(orderStrokes([], { x: 0, y: 0 })).toEqual([]);
  });
});
