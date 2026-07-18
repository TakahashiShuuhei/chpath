import { describe, expect, it } from 'vitest';
import {
  dist,
  pointOnArc,
  reverseSegment,
  reverseStroke,
  segEnd,
  segStart,
  strokeEnd,
  strokeStart,
  type ArcSeg,
  type LineSeg,
  type Stroke,
} from './types';

describe('segStart/segEnd', () => {
  describe('前提: 直線セグメントの場合', () => {
    const line: LineSeg = { type: 'line', from: { x: 1, y: 2 }, to: { x: 3, y: 4 } };

    it('segStartはfromをそのまま返す', () => {
      expect(segStart(line)).toEqual({ x: 1, y: 2 });
    });

    it('segEndはtoをそのまま返す', () => {
      expect(segEnd(line)).toEqual({ x: 3, y: 4 });
    });
  });

  describe('前提: 円弧セグメントの場合', () => {
    const arc: ArcSeg = {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      ccw: true,
    };

    it('segStartはstartAngle上の円周の点を返す', () => {
      const p = segStart(arc);
      expect(p.x).toBeCloseTo(10);
      expect(p.y).toBeCloseTo(0);
    });

    it('segEndはendAngle上の円周の点を返す', () => {
      const p = segEnd(arc);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(10);
    });
  });
});

describe('pointOnArc', () => {
  it('中心・半径・角度から円周上の座標を計算する', () => {
    const arc: ArcSeg = { type: 'arc', center: { x: 5, y: 5 }, radius: 2, startAngle: 0, endAngle: 0, ccw: true };
    const p = pointOnArc(arc, Math.PI);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(5);
  });
});

describe('reverseSegment', () => {
  it('前提: 直線セグメント / 操作: 反転する / 期待: from,toが入れ替わる', () => {
    const line: LineSeg = { type: 'line', from: { x: 1, y: 2 }, to: { x: 3, y: 4 } };
    expect(reverseSegment(line)).toEqual({ type: 'line', from: { x: 3, y: 4 }, to: { x: 1, y: 2 } });
  });

  it('前提: 円弧セグメント / 操作: 反転する / 期待: start,endAngleが入れ替わりccwも反転する', () => {
    const arc: ArcSeg = {
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 1,
      startAngle: 0.1,
      endAngle: 0.9,
      ccw: true,
    };
    expect(reverseSegment(arc)).toEqual({
      type: 'arc',
      center: { x: 0, y: 0 },
      radius: 1,
      startAngle: 0.9,
      endAngle: 0.1,
      ccw: false,
    });
  });
});

describe('reverseStroke', () => {
  it('前提: 直線2本からなるストローク / 操作: 反転する / 期待: セグメントの並び順が逆になり、各セグメントも反転される', () => {
    const stroke: Stroke = [
      { type: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { type: 'line', from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
    ];
    const reversed = reverseStroke(stroke);
    expect(reversed).toEqual([
      { type: 'line', from: { x: 1, y: 1 }, to: { x: 1, y: 0 } },
      { type: 'line', from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
    ]);
  });

  it('反転しても始点・終点が入れ替わるだけで通過点は保たれる(strokeStart/strokeEndで確認)', () => {
    const stroke: Stroke = [
      { type: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { type: 'line', from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
    ];
    const reversed = reverseStroke(stroke);
    expect(strokeStart(reversed)).toEqual(strokeEnd(stroke));
    expect(strokeEnd(reversed)).toEqual(strokeStart(stroke));
  });
});

describe('dist', () => {
  it('2点間のユークリッド距離を返す', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('同じ点同士の距離は0', () => {
    expect(dist({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });
});
