import { describe, expect, it } from 'vitest';
import { layoutText } from './layout';
import { segEnd, segStart, type Glyph } from './types';

/** テスト用: (0,0)-(right,0)の直線1本だけを持つ単純なグリフを作る */
function makeGlyph(char: string, right: number, advance: number): Glyph {
  return {
    char,
    advance,
    strokes: [[{ type: 'line', from: { x: 0, y: 0 }, to: { x: right, y: 0 } }]],
  };
}

describe('layoutText', () => {
  describe('前提: 2文字とも隙間なく連続する(グリフの右端=advance)グリフの場合', () => {
    const glyphs = new Map<string, Glyph>([
      ['A', makeGlyph('A', 1000, 1000)],
      ['B', makeGlyph('B', 1000, 1000)],
    ]);

    it('操作: fontSize=10でlayoutTextする / 期待: 各文字がadvance*scale分だけ右にずれて配置される', () => {
      const layout = layoutText('AB', glyphs, 10);
      expect(layout.strokes).toHaveLength(2);
      expect(layout.strokes[0][0]).toEqual({ type: 'line', from: { x: 5, y: 12 }, to: { x: 15, y: 12 } });
      expect(layout.strokes[1][0]).toEqual({ type: 'line', from: { x: 15, y: 12 }, to: { x: 25, y: 12 } });
    });

    it('期待: 隙間がないため、文字間にペンアップ移動(travel)は発生しない', () => {
      const layout = layoutText('AB', glyphs, 10);
      expect(layout.travels).toHaveLength(0);
    });

    it('期待: widthはマージンを含めた最終的なペン位置の右端になる', () => {
      const layout = layoutText('AB', glyphs, 10);
      expect(layout.width).toBeCloseTo(30); // marginX(5) + 2文字分(10+10) + marginX(5)
    });
  });

  describe('前提: グリフの描画がadvance幅より手前で終わっている(次の文字との間に隙間がある)場合', () => {
    const glyphs = new Map<string, Glyph>([['C', makeGlyph('C', 500, 1000)]]);

    it('操作: "CC"をlayoutTextする / 期待: 1文字目の終点と2文字目の開始点の間にペンアップ移動が1回発生する', () => {
      const layout = layoutText('CC', glyphs, 10);
      expect(layout.travels).toHaveLength(1);
      expect(layout.travels[0]).toEqual({ from: { x: 10, y: 12 }, to: { x: 15, y: 12 } });
    });
  });

  describe('前提: 改行文字を含む場合', () => {
    const glyphs = new Map<string, Glyph>([['A', makeGlyph('A', 1000, 1000)]]);

    it('操作: "A\\nA"をlayoutTextする / 期待: 2文字目は行頭(x=marginX)・y=marginY+lineHeightの位置に配置される', () => {
      const layout = layoutText('A\nA', glyphs, 10, 20);
      // 1文字目: from(5,12)-to(15,12) / 改行 / 2文字目: 行頭(x=5)、y=12+20=32
      // (前の行から続くペン位置の都合でストローク自体は反転されるため、始点・終点の集合で比較する)
      const second = layout.strokes[1][0];
      const start = segStart(second);
      const end = segEnd(second);
      const xs = [start.x, end.x].sort((a, b) => a - b);
      expect(xs).toEqual([5, 15]);
      expect(start.y).toBe(32);
      expect(end.y).toBe(32);
    });

    it('期待: heightは最終行のy位置を反映して増える', () => {
      const oneLine = layoutText('A', glyphs, 10, 20);
      const twoLines = layoutText('A\nA', glyphs, 10, 20);
      expect(twoLines.height).toBeGreaterThan(oneLine.height);
    });
  });

  describe('前提: glyphsに存在しない文字が含まれる場合', () => {
    const glyphs = new Map<string, Glyph>();

    it('操作: 未対応の文字(スペース以外)をlayoutTextする / 期待: missingに座標付きで記録され、strokesは追加されない', () => {
      const layout = layoutText('Z', glyphs, 10);
      expect(layout.strokes).toHaveLength(0);
      expect(layout.missing).toEqual([{ char: 'Z', x: 5, y: 12, size: 10 }]);
    });

    it('操作: スペースをlayoutTextする / 期待: missingには記録されないが、幅の分だけxは進む(widthに反映される)', () => {
      const layout = layoutText(' ', glyphs, 10);
      expect(layout.missing).toHaveLength(0);
      expect(layout.width).toBeCloseTo(5 + 10 * 0.6 + 5);
    });
  });
});
