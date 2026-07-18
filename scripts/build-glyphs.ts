import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GlyphSource } from '../src/core/types';
import { fetchHersheyGlyphs } from './sources/hershey';
import { fetchKanjiVgGlyphs, loadTargetChars } from './sources/kanjivg';

const OUT_PATH = path.resolve(import.meta.dirname, '../public/glyphs.json');
const ROUND = 100; // 小数点2桁相当に丸めてファイルサイズを抑える

async function main() {
  console.log('Hershey(英数字・記号)を取得中...');
  const latin = await fetchHersheyGlyphs();
  console.log(`  -> ${latin.length}字`);

  console.log('KanjiVG対象文字リストを取得中...');
  const chars = await loadTargetChars();
  console.log(`  -> ${chars.length}字 (かな+常用漢字)`);

  console.log('KanjiVG(かな・漢字)を取得中... (初回はキャッシュ作成のため時間がかかります)');
  const cjk = await fetchKanjiVgGlyphs(chars);
  console.log(`  -> ${cjk.length}字 変換成功`);

  const glyphs: GlyphSource[] = [...latin, ...cjk].map(roundGlyph);
  const pointCount = glyphs.reduce(
    (sum, g) => sum + g.strokes.reduce((s, st) => s + st.length, 0),
    0,
  );
  console.log(`合計 ${glyphs.length}字, ${pointCount}点(平坦化後、フィット前)`);

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(glyphs), 'utf-8');
  console.log(`書き出し完了: ${OUT_PATH}`);
}

function roundGlyph(g: GlyphSource): GlyphSource {
  return {
    ...g,
    advance: Math.round(g.advance * ROUND) / ROUND,
    strokes: g.strokes.map((pts) =>
      pts.map((p) => ({
        x: Math.round(p.x * ROUND) / ROUND,
        y: Math.round(p.y * ROUND) / ROUND,
      })),
    ),
  };
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
