import './style.css';
import type { GlyphSource } from './core/types';
import { fitGlyph } from './core/fitPath';
import { layoutText } from './core/layout';
import { renderSvg } from './core/renderSvg';

const DEFAULT_TEXT = '常用漢字と英数字を\n直線と円弧に変換する 🤖';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main>
    <h1>chpath</h1>
    <p class="lead">入力した文字を、ペンプロッタで描けるだけ少ない「直線」と「円弧」の組み合わせに変換します。</p>

    <div class="controls">
      <label class="field">
        文字列
        <textarea id="text" rows="3">${escapeHtml(DEFAULT_TEXT)}</textarea>
      </label>

      <div class="sliders">
        <label class="field">
          誤差許容値(大きいほどコマンド数が減る): <span id="toleranceValue"></span>
          <input id="tolerance" type="range" min="1" max="30" step="1" value="6" />
        </label>
        <label class="field">
          文字サイズ: <span id="fontSizeValue"></span>
          <input id="fontSize" type="range" min="24" max="96" step="4" value="48" />
        </label>
        <label class="field checkbox">
          <input id="showTravel" type="checkbox" checked />
          ペンアップの移動(点線)を表示
        </label>
      </div>
    </div>

    <div id="stats" class="stats"></div>
    <div id="svgContainer" class="svg-container"></div>

    <footer>
      <p>
        英数字は <a href="https://github.com/techninja/hersheytextjs" target="_blank" rel="noopener">Hershey Fonts</a>(Public Domain)、
        漢字・かなは <a href="http://kanjivg.tagaini.net/" target="_blank" rel="noopener">KanjiVG</a>
        (© 2009-2011 Ulrich Apel, CC BY-SA 3.0) のストロークデータを、直線・円弧に変換して使用しています。
        未対応の文字は破線の枠で表示されます。
      </p>
    </footer>
  </main>
`;

const textEl = document.querySelector<HTMLTextAreaElement>('#text')!;
const toleranceEl = document.querySelector<HTMLInputElement>('#tolerance')!;
const toleranceValueEl = document.querySelector<HTMLSpanElement>('#toleranceValue')!;
const fontSizeEl = document.querySelector<HTMLInputElement>('#fontSize')!;
const fontSizeValueEl = document.querySelector<HTMLSpanElement>('#fontSizeValue')!;
const showTravelEl = document.querySelector<HTMLInputElement>('#showTravel')!;
const statsEl = document.querySelector<HTMLDivElement>('#stats')!;
const svgContainer = document.querySelector<HTMLDivElement>('#svgContainer')!;

let glyphSources = new Map<string, GlyphSource>();

async function main() {
  statsEl.textContent = 'グリフデータを読み込み中...';
  const res = await fetch(`${import.meta.env.BASE_URL}glyphs.json`);
  const list = (await res.json()) as GlyphSource[];
  glyphSources = new Map(list.map((g) => [g.char, g]));

  for (const el of [textEl, toleranceEl, fontSizeEl, showTravelEl]) {
    el.addEventListener('input', render);
  }
  render();
}

function render() {
  const tolerance = Number(toleranceEl.value);
  const fontSize = Number(fontSizeEl.value);
  const showTravel = showTravelEl.checked;
  toleranceValueEl.textContent = String(tolerance);
  fontSizeValueEl.textContent = `${fontSize}px`;

  const text = textEl.value;
  const neededChars = new Set(text);
  const glyphs = new Map(
    [...neededChars]
      .map((ch) => glyphSources.get(ch))
      .filter((g): g is GlyphSource => g !== undefined)
      .map((g) => [g.char, fitGlyph(g, tolerance)] as const),
  );

  const layout = layoutText(text, glyphs, fontSize);
  svgContainer.innerHTML = renderSvg(layout, { showTravel });

  const lineCount = countByType(layout.strokes, 'line');
  const arcCount = countByType(layout.strokes, 'arc');
  const missingNote =
    layout.missing.length > 0
      ? ` / 未対応文字 ${layout.missing.length}字(${[...new Set(layout.missing.map((m) => m.char))].join('')})`
      : '';
  statsEl.textContent =
    `直線 ${lineCount}本 + 円弧 ${arcCount}本 = 描画コマンド ${lineCount + arcCount}個` +
    ` / ペンアップ移動 ${layout.travels.length}回${missingNote}`;
}

function countByType(strokes: { type: string }[][], type: string): number {
  return strokes.reduce((sum, s) => sum + s.filter((seg) => seg.type === type).length, 0);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

main();
