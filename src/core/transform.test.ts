import { describe, expect, it } from 'vitest';
import { transformStroke } from './transform';
import type { ArcSeg, LineSeg, Stroke } from './types';

describe('transformStroke', () => {
  describe('前提: 直線セグメントを含むストローク', () => {
    it('操作: scale=2, dx=10, dy=100で変換する / 期待: from,toの座標がscale倍されてから平行移動される', () => {
      const line: LineSeg = { type: 'line', from: { x: 1, y: 2 }, to: { x: 3, y: 4 } };
      const [result] = transformStroke([line], 2, 10, 100);
      expect(result).toEqual({
        type: 'line',
        from: { x: 1 * 2 + 10, y: 2 * 2 + 100 },
        to: { x: 3 * 2 + 10, y: 4 * 2 + 100 },
      });
    });
  });

  describe('前提: 円弧セグメントを含むストローク', () => {
    const arc: ArcSeg = {
      type: 'arc',
      center: { x: 5, y: 5 },
      radius: 10,
      startAngle: 0.3,
      endAngle: 1.2,
      ccw: true,
    };
    const stroke: Stroke = [arc];

    it('操作: scale=3, dx=1, dy=2で変換する / 期待: 中心はscale倍+平行移動、半径はscale倍される', () => {
      const [result] = transformStroke(stroke, 3, 1, 2) as [ArcSeg];
      expect(result.center).toEqual({ x: 5 * 3 + 1, y: 5 * 3 + 2 });
      expect(result.radius).toBe(30);
    });

    it('期待: 相似変換のみのため、startAngle・endAngle・ccwは変化しない', () => {
      const [result] = transformStroke(stroke, 3, 1, 2) as [ArcSeg];
      expect(result.startAngle).toBe(arc.startAngle);
      expect(result.endAngle).toBe(arc.endAngle);
      expect(result.ccw).toBe(arc.ccw);
    });
  });
});
