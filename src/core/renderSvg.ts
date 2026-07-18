import type { ArcSeg, Segment, Stroke } from './types';
import { pointOnArc, segStart } from './types';
import type { LayoutResult } from './layout';

export function renderSvg(layout: LayoutResult, opts: { showTravel: boolean }): string {
  const strokePaths = layout.strokes
    .map((s) => `<path d="${strokeToPathData(s)}" />`)
    .join('\n');

  const travelPaths = opts.showTravel
    ? layout.travels
        .map((t) => `<line x1="${fmt(t.from.x)}" y1="${fmt(t.from.y)}" x2="${fmt(t.to.x)}" y2="${fmt(t.to.y)}" />`)
        .join('\n')
    : '';

  const missingBoxes = layout.missing
    .map((m) => {
      const s = m.size * 0.8;
      return `<rect x="${fmt(m.x)}" y="${fmt(m.y - s)}" width="${fmt(s)}" height="${fmt(s)}" />`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(layout.width)} ${fmt(layout.height)}">
  <g class="missing">${missingBoxes}</g>
  <g class="travel">${travelPaths}</g>
  <g class="drawing">${strokePaths}</g>
</svg>`;
}

function strokeToPathData(stroke: Stroke): string {
  if (stroke.length === 0) return '';
  const start = segStart(stroke[0]);
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`;
  for (const seg of stroke) {
    d += ' ' + segmentToPathData(seg);
  }
  return d;
}

function segmentToPathData(seg: Segment): string {
  if (seg.type === 'line') {
    return `L ${fmt(seg.to.x)} ${fmt(seg.to.y)}`;
  }
  return arcToPathData(seg);
}

function arcToPathData(arc: ArcSeg): string {
  const end = pointOnArc(arc, arc.endAngle);
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const delta = arc.ccw ? norm(arc.endAngle - arc.startAngle) : norm(arc.startAngle - arc.endAngle);
  const largeArc = delta > Math.PI ? 1 : 0;
  const sweep = arc.ccw ? 1 : 0;
  return `A ${fmt(arc.radius)} ${fmt(arc.radius)} 0 ${largeArc} ${sweep} ${fmt(end.x)} ${fmt(end.y)}`;
}

function fmt(n: number): string {
  return Math.round(n * 100) / 100 + '';
}
