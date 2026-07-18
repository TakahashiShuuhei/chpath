import type { ArcSeg, Segment } from './types';
import { pointOnArc, segStart } from './types';
import type { LayoutResult } from './layout';

export type ColorMode = 'black' | 'order';

const SERIES_COUNT = 8;

export function renderSvg(layout: LayoutResult, opts: { showTravel: boolean; colorMode: ColorMode }): string {
  let segIndex = 0;
  const strokePaths = layout.strokes
    .flatMap((stroke) =>
      stroke.map((seg) => {
        const d = `M ${fmtPoint(segStart(seg))} ${segmentToPathData(seg)}`;
        const style =
          opts.colorMode === 'order' ? ` style="stroke: var(--series-${(segIndex % SERIES_COUNT) + 1})"` : '';
        segIndex++;
        return `<path d="${d}"${style} />`;
      }),
    )
    .join('\n');

  const travelPaths = opts.showTravel
    ? layout.travels
        .map((t) => `<line x1="${fmt(t.from.x)}" y1="${fmt(t.from.y)}" x2="${fmt(t.to.x)}" y2="${fmt(t.to.y)}" />`)
        .join('\n')
    : '';

  const missingBoxes = layout.missing
    .map((m) => {
      // 実際の文字はy(上端)からy+size(下端)まで描かれるため、同じ範囲に少し内側の余白を付けて表示する
      const inset = m.size * 0.1;
      const s = m.size - inset * 2;
      return `<rect x="${fmt(m.x + inset)}" y="${fmt(m.y + inset)}" width="${fmt(s)}" height="${fmt(s)}" />`;
    })
    .join('\n');

  const w = fmt(layout.width);
  const h = fmt(layout.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g class="missing">${missingBoxes}</g>
  <g class="travel">${travelPaths}</g>
  <g class="drawing">${strokePaths}</g>
</svg>`;
}

function segmentToPathData(seg: Segment): string {
  if (seg.type === 'line') {
    return `L ${fmtPoint(seg.to)}`;
  }
  return arcToPathData(seg);
}

function arcToPathData(arc: ArcSeg): string {
  const end = pointOnArc(arc, arc.endAngle);
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const delta = arc.ccw ? norm(arc.endAngle - arc.startAngle) : norm(arc.startAngle - arc.endAngle);
  const largeArc = delta > Math.PI ? 1 : 0;
  const sweep = arc.ccw ? 1 : 0;
  return `A ${fmt(arc.radius)} ${fmt(arc.radius)} 0 ${largeArc} ${sweep} ${fmtPoint(end)}`;
}

function fmtPoint(p: { x: number; y: number }): string {
  return `${fmt(p.x)} ${fmt(p.y)}`;
}

function fmt(n: number): string {
  return Math.round(n * 100) / 100 + '';
}
