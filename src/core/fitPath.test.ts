import { describe, expect, it } from 'vitest';
import { fitGlyph, fitPointsToStroke, flattenStroke, type RawSeg } from './fitPath';
import { segEnd, segStart, type ArcSeg, type GlyphSource, type Point } from './types';

describe('flattenStroke', () => {
  describe('前提: 直線セグメントのみで構成されるサブパスの場合', () => {
    it('操作: 平坦化する / 期待: 各セグメントの端点がそのまま点列になる(重複する接続点は1つにまとまる)', () => {
      const raw: RawSeg[] = [
        { type: 'line', from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
        { type: 'line', from: { x: 10, y: 0 }, to: { x: 10, y: 10 } },
      ];
      expect(flattenStroke(raw)).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]);
    });
  });

  describe('前提: 3次ベジエセグメントを含むサブパスの場合', () => {
    it('操作: 平坦化する / 期待: 曲線がサンプリングされ、始点と終点が元のベジエのfrom,toと一致する複数の点列になる', () => {
      const raw: RawSeg[] = [
        {
          type: 'cubic',
          from: { x: 0, y: 0 },
          c1: { x: 0, y: 10 },
          c2: { x: 10, y: 10 },
          to: { x: 10, y: 0 },
        },
      ];
      const points = flattenStroke(raw);
      expect(points.length).toBeGreaterThan(2);
      expect(points[0]).toEqual({ x: 0, y: 0 });
      expect(points[points.length - 1]).toEqual({ x: 10, y: 0 });
    });
  });

  describe('前提: 長さがほぼ0のセグメントが連続する場合', () => {
    it('操作: 平坦化する / 期待: ほぼ同じ位置の連続する点は1つに間引かれる', () => {
      const raw: RawSeg[] = [
        { type: 'line', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
        { type: 'line', from: { x: 5, y: 5 }, to: { x: 5, y: 5 } },
      ];
      expect(flattenStroke(raw)).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ]);
    });
  });
});

describe('fitPointsToStroke', () => {
  describe('前提: 点が1つ以下、または2つの場合', () => {
    it('点が1つの場合 / 期待: 描画できないので空のストロークを返す', () => {
      expect(fitPointsToStroke([{ x: 0, y: 0 }], 1)).toEqual([]);
    });

    it('点が2つの場合 / 期待: tolerance=0でも必ず1本の直線になる', () => {
      const stroke = fitPointsToStroke([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0);
      expect(stroke).toEqual([{ type: 'line', from: { x: 0, y: 0 }, to: { x: 10, y: 0 } }]);
    });
  });

  describe('前提: 3点以上が一直線上に(誤差許容値以内で)並んでいる場合', () => {
    it('操作: fitPointsToStrokeする / 期待: 1本の直線セグメントにまとまる', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ];
      const stroke = fitPointsToStroke(points, 0.5);
      expect(stroke).toHaveLength(1);
      expect(stroke[0].type).toBe('line');
    });
  });

  describe('前提: 点列が円周上に(誤差許容値以内で)並んでいる場合', () => {
    it('操作: fitPointsToStrokeする / 期待: 1本の円弧セグメントにまとまり、中心・半径が元の円と一致する', () => {
      const center = { x: 0, y: 0 };
      const radius = 10;
      const points: Point[] = [0, 22.5, 45, 67.5, 90].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return { x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) };
      });
      const stroke = fitPointsToStroke(points, 0.01);
      expect(stroke).toHaveLength(1);
      expect(stroke[0].type).toBe('arc');
      const arc = stroke[0] as ArcSeg;
      expect(arc.center.x).toBeCloseTo(center.x, 3);
      expect(arc.center.y).toBeCloseTo(center.y, 3);
      expect(arc.radius).toBeCloseTo(radius, 3);
    });
  });

  describe('前提: 直角に折れ曲がる点列(1本の直線・円弧では表現できない)の場合', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
    ];

    it('操作: 誤差許容値を小さくしてfitPointsToStrokeする / 期待: 角の付近で分割され複数セグメントになる', () => {
      const stroke = fitPointsToStroke(points, 0.01);
      expect(stroke.length).toBeGreaterThanOrEqual(2);
    });

    it('期待: 分割されても各セグメントは端点で連続しており、全体の始点・終点は元の点列と一致する', () => {
      const stroke = fitPointsToStroke(points, 0.01);
      const closePoint = (a: Point, b: Point) => {
        expect(a.x).toBeCloseTo(b.x);
        expect(a.y).toBeCloseTo(b.y);
      };
      for (let i = 1; i < stroke.length; i++) {
        closePoint(segEnd(stroke[i - 1]), segStart(stroke[i]));
      }
      closePoint(segStart(stroke[0]), points[0]);
      closePoint(segEnd(stroke[stroke.length - 1]), points[points.length - 1]);
    });

    it('操作: 誤差許容値を十分大きくしてfitPointsToStrokeする / 期待: 1本の直線に収まり、セグメント数が減る', () => {
      const loose = fitPointsToStroke(points, 100);
      const strict = fitPointsToStroke(points, 0.01);
      expect(loose).toHaveLength(1);
      expect(loose.length).toBeLessThan(strict.length);
    });
  });
});

describe('fitGlyph', () => {
  it('前提: フィット後に空になるストローク(点が1つしかない)を含むGlyphSourceの場合 / 期待: そのストロークは結果から除外される', () => {
    const source: GlyphSource = {
      char: 'x',
      advance: 500,
      strokes: [
        [{ x: 0, y: 0 }], // 1点だけ -> フィット後に空になる
        [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      ],
    };
    const glyph = fitGlyph(source, 1);
    expect(glyph.char).toBe('x');
    expect(glyph.advance).toBe(500);
    expect(glyph.strokes).toHaveLength(1);
    expect(glyph.strokes[0]).toEqual([{ type: 'line', from: { x: 0, y: 0 }, to: { x: 10, y: 0 } }]);
  });
});
