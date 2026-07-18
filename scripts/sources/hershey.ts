import type { GlyphSource } from '../../src/core/types';
import { parseSvgPath } from '../../src/core/svgPath';
import { flattenStroke } from '../../src/core/fitPath';

const HERSHEY_URL = 'https://raw.githubusercontent.com/techninja/hersheytextjs/master/hersheytext.json';
const FONT_NAME = 'futural'; // Sans 1-stroke: 古典的なペンプロッタ用単線フォント

// Hershey生データのスケール(概ねcap-heightが21units)をem=1000系に合わせるための係数
const SCALE = 1000 / 24;
const SPACE_ADVANCE = 12 * SCALE;
// 右側の余白(次の文字とぶつからないようにするマージン)
const RIGHT_BEARING = 2 * SCALE;

type HersheyChar = { d: string; o: number };
type HersheyFont = { name: string; chars: HersheyChar[] };
type HersheyData = Record<string, HersheyFont>;

export async function fetchHersheyGlyphs(): Promise<GlyphSource[]> {
  const res = await fetch(HERSHEY_URL);
  if (!res.ok) throw new Error(`Hershey font data取得に失敗: ${res.status}`);
  const data = (await res.json()) as HersheyData;
  const font = data[FONT_NAME];

  const glyphs: GlyphSource[] = [];
  glyphs.push({ char: ' ', strokes: [], advance: SPACE_ADVANCE });

  // fontの文字テーブルは "!"(33) から始まる95文字分
  for (let code = 33; code < 33 + font.chars.length; code++) {
    const entry = font.chars[code - 33];
    if (!entry) continue;
    const scaled = scalePathString(entry.d, SCALE);
    const subpaths = parseSvgPath(scaled);
    const strokes = subpaths.map((sp) => flattenStroke(sp)).filter((s) => s.length > 1);

    // JSON中の`o`(width)フィールドは実際のインク幅より狭く、文字が重なる原因になるため
    // 実際に描画される座標の右端から自前でアドバンス幅を計算する。
    const maxX = Math.max(0, ...strokes.flatMap((s) => s.map((p) => p.x)));
    const advance = strokes.length > 0 ? maxX + RIGHT_BEARING : entry.o * SCALE;

    glyphs.push({ char: String.fromCharCode(code), strokes, advance });
  }
  return glyphs;
}

/** "M4,1 L4,22 ..." のような絶対座標の数値だけをスケールする(コマンド文字はそのまま) */
function scalePathString(d: string, scale: number): string {
  return d.replace(/-?\d+(?:\.\d+)?/g, (m) => String(Number(m) * scale));
}
