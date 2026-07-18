import { describe, expect, it } from 'vitest';
import { parseSvgPath } from './svgPath';
import type { RawCubic, RawLine } from './fitPath';

describe('parseSvgPath', () => {
  describe('M/Lコマンド', () => {
    it('前提: "M0,0 L10,0"というd文字列 / 期待: 1つのサブパスに1本の直線セグメントが入る', () => {
      const subpaths = parseSvgPath('M0,0 L10,0');
      expect(subpaths).toHaveLength(1);
      expect(subpaths[0]).toEqual([
        { type: 'line', from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
      ]);
    });

    it('前提: Mが複数回現れるd文字列 / 期待: Mごとに新しいサブパスが開始される', () => {
      const subpaths = parseSvgPath('M0,0 L1,0 M5,5 L6,5');
      expect(subpaths).toHaveLength(2);
      expect(subpaths[0]).toEqual([{ type: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]);
      expect(subpaths[1]).toEqual([{ type: 'line', from: { x: 5, y: 5 }, to: { x: 6, y: 5 } }]);
    });

    it('前提: 小文字(相対座標)のm,lコマンド / 期待: 直前の現在点からの相対位置として解釈される', () => {
      const subpaths = parseSvgPath('m10,10 l5,0 0,5');
      const segs = subpaths[0] as RawLine[];
      expect(segs[0]).toEqual({ type: 'line', from: { x: 10, y: 10 }, to: { x: 15, y: 10 } });
      // Lの後に続く数値の並びは、直前のLコマンドが繰り返されたものとして解釈される
      expect(segs[1]).toEqual({ type: 'line', from: { x: 15, y: 10 }, to: { x: 15, y: 15 } });
    });

    it('前提: Lコマンドの後にコマンド文字なしで数値が連続する / 期待: 直前のコマンドの繰り返しとして複数の直線になる', () => {
      const subpaths = parseSvgPath('M0,0 L1,0 2,0 3,0');
      expect(subpaths[0]).toHaveLength(3);
    });
  });

  describe('H/Vコマンド', () => {
    it('前提: Hコマンド / 期待: 現在のy座標を保ったまま指定されたx座標まで水平線を引く', () => {
      const subpaths = parseSvgPath('M0,5 H20');
      expect(subpaths[0]).toEqual([{ type: 'line', from: { x: 0, y: 5 }, to: { x: 20, y: 5 } }]);
    });

    it('前提: Vコマンド / 期待: 現在のx座標を保ったまま指定されたy座標まで垂直線を引く', () => {
      const subpaths = parseSvgPath('M5,0 V20');
      expect(subpaths[0]).toEqual([{ type: 'line', from: { x: 5, y: 0 }, to: { x: 5, y: 20 } }]);
    });

    it('前提: 小文字のh,vコマンド(相対座標) / 期待: 現在位置からの相対距離として移動する', () => {
      const subpaths = parseSvgPath('M5,5 h10 v-3');
      const segs = subpaths[0] as RawLine[];
      expect(segs[0].to).toEqual({ x: 15, y: 5 });
      expect(segs[1].to).toEqual({ x: 15, y: 2 });
    });
  });

  describe('C/Sコマンド(3次ベジエ)', () => {
    it('前提: Cコマンド / 期待: 指定した2つの制御点を持つ3次ベジエセグメントになる', () => {
      const subpaths = parseSvgPath('M0,0 C1,1 2,1 3,0');
      const seg = subpaths[0][0] as RawCubic;
      expect(seg).toEqual({
        type: 'cubic',
        from: { x: 0, y: 0 },
        c1: { x: 1, y: 1 },
        c2: { x: 2, y: 1 },
        to: { x: 3, y: 0 },
      });
    });

    it('前提: Cコマンドの直後にSコマンドが続く / 期待: Sの第1制御点は直前の第2制御点を現在点about反射した点になる', () => {
      const subpaths = parseSvgPath('M0,0 C0,1 2,1 2,0 S4,-1 4,0');
      const s = subpaths[0][1] as RawCubic;
      // 直前のc2=(2,1)をcur=(2,0)について反射 -> (2, -1)
      expect(s.c1).toEqual({ x: 2, y: -1 });
      expect(s.c2).toEqual({ x: 4, y: -1 });
      expect(s.to).toEqual({ x: 4, y: 0 });
    });

    it('前提: 直前がCコマンドでない状態でSコマンドを使う / 期待: 第1制御点として現在点そのものを使う', () => {
      const subpaths = parseSvgPath('M0,0 S2,1 3,0');
      const s = subpaths[0][0] as RawCubic;
      expect(s.c1).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Q/Tコマンド(2次ベジエ)', () => {
    it('前提: Qコマンド / 期待: 2次ベジエの制御点1つを3次ベジエの2つの制御点に変換して保持する', () => {
      const subpaths = parseSvgPath('M0,0 Q1,2 2,0');
      const seg = subpaths[0][0] as RawCubic;
      // 2次->3次変換: c1 = from + 2/3*(qc-from), c2 = to + 2/3*(qc-to)
      expect(seg.c1.x).toBeCloseTo(0 + (2 / 3) * 1);
      expect(seg.c1.y).toBeCloseTo(0 + (2 / 3) * 2);
      expect(seg.c2.x).toBeCloseTo(2 + (2 / 3) * (1 - 2));
      expect(seg.c2.y).toBeCloseTo(0 + (2 / 3) * 2);
    });

    it('前提: Qコマンドの直後にTコマンドが続く / 期待: 直前の2次制御点を現在点について反射した点を使う', () => {
      const subpaths = parseSvgPath('M0,0 Q1,2 2,0 T4,0');
      const t = subpaths[0][1] as RawCubic;
      // 直前のqc=(1,2)をcur=(2,0)について反射 -> (3,-2)
      expect(t.c1.x).toBeCloseTo(2 + (2 / 3) * (3 - 2));
      expect(t.c1.y).toBeCloseTo(0 + (2 / 3) * (-2 - 0));
    });
  });

  describe('Zコマンド', () => {
    it('前提: サブパスの開始点と異なる位置で終わっている / 期待: 開始点まで直線を1本追加して閉じる', () => {
      const subpaths = parseSvgPath('M0,0 L10,0 L10,10 Z');
      const last = subpaths[0][subpaths[0].length - 1] as RawLine;
      expect(last).toEqual({ type: 'line', from: { x: 10, y: 10 }, to: { x: 0, y: 0 } });
    });
  });
});
