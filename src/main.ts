import './style.css';
import type { GlyphSource } from './core/types';
import { fitGlyph } from './core/fitPath';
import { layoutText } from './core/layout';
import { renderSvg, type ColorMode } from './core/renderSvg';
import { describeCommands } from './core/describeCommands';

const DEFAULT_TEXT = '常用漢字と英数字を\n直線と円弧に変換する 🤖';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main>
    <h1>chpath</h1>
    <p class="lead">入力した文字を、ペンプロッタで描けるだけ少ない「直線」と「円弧」の組み合わせに変換します。</p>

    <section class="panel">
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
          <input id="fontSize" type="range" min="24" max="200" step="4" value="48" />
        </label>
      </div>

      <div class="toggles">
        <div class="segmented" id="colorModeGroup">
          <label><input type="radio" name="colorMode" value="black" checked />仕上がり(黒)</label>
          <label><input type="radio" name="colorMode" value="order" />構造(色分け)</label>
        </div>
        <label class="field checkbox">
          <input id="showTravel" type="checkbox" checked />
          ペンアップの移動(点線)を表示
        </label>
      </div>
    </section>

    <div id="stats" class="stats"></div>
    <div id="svgContainer" class="svg-container"></div>

    <section class="panel commands">
      <div class="commands-head">
        <span>生成された直線・円弧の一覧</span>
        <button id="copyCommands" type="button">コピー</button>
      </div>
      <p class="hint">
        <code># stroke N</code> はペンを下ろしたまま描き続ける一区切り(ストローク)の開始です。
        <code>L (x1, y1) -&gt; (x2, y2)</code> は開始点から終了点までの直線、
        <code>A center=(cx, cy) r=半径 angle=開始-&gt;終了 ccw/cw</code> は中心・半径と、
        開始角度から終了角度まで反時計回り(ccw)・時計回り(cw)に描く円弧を表します
        (角度の単位はラジアン、座標・半径の単位はpx)。
      </p>
      <textarea id="commandList" readonly rows="8" spellcheck="false"></textarea>
    </section>

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
const colorModeGroupEl = document.querySelector<HTMLDivElement>('#colorModeGroup')!;
const statsEl = document.querySelector<HTMLDivElement>('#stats')!;
const svgContainer = document.querySelector<HTMLDivElement>('#svgContainer')!;
const commandListEl = document.querySelector<HTMLTextAreaElement>('#commandList')!;
const copyCommandsEl = document.querySelector<HTMLButtonElement>('#copyCommands')!;

let glyphSources = new Map<string, GlyphSource>();

async function main() {
  statsEl.textContent = 'グリフデータを読み込み中...';
  const res = await fetch(`${import.meta.env.BASE_URL}glyphs.json`);
  const list = (await res.json()) as GlyphSource[];
  glyphSources = new Map(list.map((g) => [g.char, g]));

  for (const el of [textEl, toleranceEl, fontSizeEl, showTravelEl]) {
    el.addEventListener('input', render);
  }
  colorModeGroupEl.addEventListener('change', render);
  commandListEl.addEventListener('focus', () => commandListEl.select());
  copyCommandsEl.addEventListener('click', async () => {
    await navigator.clipboard.writeText(commandListEl.value);
    copyCommandsEl.textContent = 'コピーしました';
    setTimeout(() => (copyCommandsEl.textContent = 'コピー'), 1500);
  });

  render();
}

function render() {
  const tolerance = Number(toleranceEl.value);
  const fontSize = Number(fontSizeEl.value);
  const showTravel = showTravelEl.checked;
  const colorMode = (colorModeGroupEl.querySelector('input:checked') as HTMLInputElement).value as ColorMode;
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
  svgContainer.innerHTML = renderSvg(layout, { showTravel, colorMode });
  commandListEl.value = describeCommands(layout);

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
