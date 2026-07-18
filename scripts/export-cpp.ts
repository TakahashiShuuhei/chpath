import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fitGlyph } from '../src/core/fitPath';
import type { GlyphSource, Segment } from '../src/core/types';

// TSのWebデモと同じ既定値(誤差許容値)でフィットし、その結果(直線・円弧の
// 確定済みデータ)をcpp/chpath.cppにそのまま埋め込む。C++側は実行時に
// 誤差許容値を変えられないので、ここで固定してしまう。
const TOLERANCE = 6;

const GLYPHS_JSON = path.resolve(import.meta.dirname, '../public/glyphs.json');
const OUT_PATH = path.resolve(import.meta.dirname, '../cpp/chpath.cpp');

function fmtNum(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function hexId(codePoint: number): string {
  return 'g' + codePoint.toString(16).padStart(5, '0');
}

function segmentLiteral(seg: Segment): string {
  if (seg.type === 'line') {
    return (
      `{Segment::Type::Line,{${fmtNum(seg.from.x)},${fmtNum(seg.from.y)}},` +
      `{${fmtNum(seg.to.x)},${fmtNum(seg.to.y)}},{},0,0,0,false}`
    );
  }
  return (
    `{Segment::Type::Arc,{},{},{${fmtNum(seg.center.x)},${fmtNum(seg.center.y)}},` +
    `${fmtNum(seg.radius)},${fmtNum(seg.startAngle)},${fmtNum(seg.endAngle)},${seg.ccw ? 'true' : 'false'}}`
  );
}

function main() {
  const sources: GlyphSource[] = JSON.parse(readFileSync(GLYPHS_JSON, 'utf-8'));

  const dataChunks: string[] = [];
  const glyphEntries: string[] = [];

  for (const source of sources) {
    const glyph = fitGlyph(source, TOLERANCE);
    const codePoint = source.char.codePointAt(0)!;
    const id = hexId(codePoint);
    const allSegments = glyph.strokes.flat();
    const strokeLengths = glyph.strokes.map((s) => s.length);

    let segArray = 'nullptr';
    let lenArray = 'nullptr';
    if (strokeLengths.length > 0) {
      segArray = `seg_${id}`;
      lenArray = `len_${id}`;
      dataChunks.push(`static const Segment ${segArray}[] = {\n${allSegments.map(segmentLiteral).join(',\n')}\n};`);
      dataChunks.push(`static const int ${lenArray}[] = {${strokeLengths.join(',')}};`);
    }

    glyphEntries.push(
      `  {0x${codePoint.toString(16)}u, ${lenArray}, ${strokeLengths.length}, ${segArray}, ` +
        `${allSegments.length}, ${fmtNum(glyph.advance)}},`,
    );
  }

  const cpp = renderTemplate(dataChunks.join('\n\n'), glyphEntries.join('\n'));
  writeFileSync(OUT_PATH, cpp, 'utf-8');

  const totalSegments = sources.reduce((sum, s) => sum + fitGlyph(s, TOLERANCE).strokes.flat().length, 0);
  console.log(`glyphs=${sources.length} segments=${totalSegments} -> ${OUT_PATH}`);
}

function renderTemplate(glyphData: string, glyphTable: string): string {
  return `// このファイルは scripts/export-cpp.ts により生成されています。
// 手で編集せず、フォントデータを更新したい場合は generate script を再実行してください。
//
// 英数字: Hershey Fonts (Public Domain)
// 漢字・かな: KanjiVG (c) 2009-2011 Ulrich Apel, CC BY-SA 3.0 (http://kanjivg.tagaini.net)

#include "chpath.h"

#include <cmath>
#include <cstdint>
#include <limits>
#include <unordered_map>
#include <utility>

namespace chpath {

namespace {

// ---- 幾何ヘルパー -------------------------------------------------------

Point pointOnArc(const Segment& arc, double angle) {
  return {arc.center.x + arc.radius * std::cos(angle), arc.center.y + arc.radius * std::sin(angle)};
}

Point segStart(const Segment& s) { return s.type == Segment::Type::Line ? s.from : pointOnArc(s, s.startAngle); }
Point segEnd(const Segment& s) { return s.type == Segment::Type::Line ? s.to : pointOnArc(s, s.endAngle); }

Point strokeStart(const Stroke& s) { return segStart(s.front()); }
Point strokeEnd(const Stroke& s) { return segEnd(s.back()); }

double dist(const Point& a, const Point& b) { return std::hypot(a.x - b.x, a.y - b.y); }

Segment reverseSegment(const Segment& s) {
  if (s.type == Segment::Type::Line) {
    return {Segment::Type::Line, s.to, s.from, {}, 0, 0, 0, false};
  }
  return {Segment::Type::Arc, {}, {}, s.center, s.radius, s.endAngle, s.startAngle, !s.ccw};
}

Stroke reverseStroke(const Stroke& s) {
  Stroke r(s.rbegin(), s.rend());
  for (auto& seg : r) seg = reverseSegment(seg);
  return r;
}

Stroke transformStroke(const Stroke& stroke, double scale, double dx, double dy) {
  Stroke result;
  result.reserve(stroke.size());
  for (Segment seg : stroke) {
    if (seg.type == Segment::Type::Line) {
      seg.from = {seg.from.x * scale + dx, seg.from.y * scale + dy};
      seg.to = {seg.to.x * scale + dx, seg.to.y * scale + dy};
    } else {
      seg.center = {seg.center.x * scale + dx, seg.center.y * scale + dy};
      seg.radius *= scale;
    }
    result.push_back(seg);
  }
  return result;
}

// 書き順は無視し、ペンアップ移動距離が短くなるよう貪欲法でストロークを並べ替える。
// 各ステップで、現在のペン位置から最も近い未処理ストロークの端点(始点・終点どちらでもよい)を選ぶ。
std::vector<Stroke> orderStrokes(std::vector<Stroke> strokes, Point pen) {
  std::vector<Stroke> ordered;
  ordered.reserve(strokes.size());

  while (!strokes.empty()) {
    size_t bestIdx = 0;
    bool bestReversed = false;
    double bestDist = std::numeric_limits<double>::infinity();

    for (size_t i = 0; i < strokes.size(); ++i) {
      const double dStart = dist(pen, strokeStart(strokes[i]));
      const double dEnd = dist(pen, strokeEnd(strokes[i]));
      if (dStart < bestDist) {
        bestDist = dStart;
        bestIdx = i;
        bestReversed = false;
      }
      if (dEnd < bestDist) {
        bestDist = dEnd;
        bestIdx = i;
        bestReversed = true;
      }
    }

    Stroke chosen = std::move(strokes[bestIdx]);
    strokes.erase(strokes.begin() + static_cast<long>(bestIdx));
    Stroke s = bestReversed ? reverseStroke(chosen) : std::move(chosen);
    pen = strokeEnd(s);
    ordered.push_back(std::move(s));
  }

  return ordered;
}

// UTF-8の1バイト以上のシーケンスをUnicodeコードポイント列に変換する
std::vector<uint32_t> decodeUtf8(const std::string& text) {
  std::vector<uint32_t> out;
  size_t i = 0;
  const size_t n = text.size();
  while (i < n) {
    const auto c = static_cast<unsigned char>(text[i]);
    uint32_t cp;
    size_t len;
    if (c < 0x80) {
      cp = c;
      len = 1;
    } else if ((c & 0xE0) == 0xC0) {
      cp = c & 0x1F;
      len = 2;
    } else if ((c & 0xF0) == 0xE0) {
      cp = c & 0x0F;
      len = 3;
    } else if ((c & 0xF8) == 0xF0) {
      cp = c & 0x07;
      len = 4;
    } else {
      ++i;  // 不正なバイトは読み飛ばす
      continue;
    }
    if (i + len > n) break;
    for (size_t k = 1; k < len; ++k) {
      cp = (cp << 6) | (static_cast<unsigned char>(text[i + k]) & 0x3F);
    }
    out.push_back(cp);
    i += len;
  }
  return out;
}

// ---- フォントデータ ------------------------------------------------------
// 以下はscripts/export-cpp.tsにより自動生成される(Hershey FontsとKanjiVGの
// ストロークデータを、Webデモと同じアルゴリズムで直線・円弧にフィットした結果)。

${glyphData}

struct GlyphData {
  uint32_t codepoint;
  const int* strokeLengths;
  int strokeCount;
  const Segment* segments;
  int segmentCount;
  double advance;
};

static const GlyphData kGlyphs[] = {
${glyphTable}
};

const std::unordered_map<uint32_t, const GlyphData*>& glyphIndex() {
  static const std::unordered_map<uint32_t, const GlyphData*> index = [] {
    std::unordered_map<uint32_t, const GlyphData*> m;
    m.reserve(sizeof(kGlyphs) / sizeof(kGlyphs[0]));
    for (const auto& g : kGlyphs) m.emplace(g.codepoint, &g);
    return m;
  }();
  return index;
}

}  // namespace

// ---- 公開API -------------------------------------------------------------

std::vector<Stroke> textToStrokes(const std::string& utf8Text, double fontSize) {
  const double scale = fontSize / 1000.0;
  const double marginX = fontSize * 0.5;
  const double marginY = fontSize * 1.2;
  const double lineHeight = fontSize * 1.6;
  const double fallbackAdvance = fontSize * 0.6;

  double x = marginX;
  double y = marginY;

  std::vector<Stroke> result;
  Point pen{};
  bool penSet = false;

  const auto& index = glyphIndex();

  for (uint32_t ch : decodeUtf8(utf8Text)) {
    if (ch == 0x0Au) {  // '\\n'
      x = marginX;
      y += lineHeight;
      continue;
    }

    const auto it = index.find(ch);
    if (it == index.end()) {
      x += fallbackAdvance;  // 埋め込みフォントに無い文字は送り幅だけ進める(スペースは通常テーブルに実データがある)
      continue;
    }

    const GlyphData& g = *it->second;

    std::vector<Stroke> placed;
    placed.reserve(static_cast<size_t>(g.strokeCount));
    int offset = 0;
    for (int i = 0; i < g.strokeCount; ++i) {
      const int len = g.strokeLengths[i];
      Stroke raw(g.segments + offset, g.segments + offset + len);
      placed.push_back(transformStroke(raw, scale, x, y));
      offset += len;
    }

    const Point startPoint = penSet ? pen : (!placed.empty() ? strokeStart(placed[0]) : Point{x, y});
    for (Stroke& s : orderStrokes(std::move(placed), startPoint)) {
      pen = strokeEnd(s);
      penSet = true;
      result.push_back(std::move(s));
    }

    x += g.advance * scale;
  }

  return result;
}

}  // namespace chpath
`;
}

main();
