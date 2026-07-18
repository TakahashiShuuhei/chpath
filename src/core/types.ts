export type Point = { x: number; y: number };

export type LineSeg = { type: 'line'; from: Point; to: Point };

export type ArcSeg = {
  type: 'arc';
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  ccw: boolean;
};

export type Segment = LineSeg | ArcSeg;

/** ペンを下ろしたまま描き続ける一続きの経路 */
export type Stroke = Segment[];

export type Glyph = {
  char: string;
  strokes: Stroke[];
  /** 次の文字を置く相対位置(em=1000基準) */
  advance: number;
};

/**
 * ビルド時に生成する未フィット(生の点列)のグリフデータ。
 * 誤差許容値はUI側で動的に変わるため、フィット前の点列のまま保存しておく。
 */
export type GlyphSource = {
  char: string;
  strokes: Point[][];
  advance: number;
};

export function segStart(seg: Segment): Point {
  return seg.type === 'line' ? seg.from : pointOnArc(seg, seg.startAngle);
}

export function segEnd(seg: Segment): Point {
  return seg.type === 'line' ? seg.to : pointOnArc(seg, seg.endAngle);
}

export function pointOnArc(arc: ArcSeg, angle: number): Point {
  return {
    x: arc.center.x + arc.radius * Math.cos(angle),
    y: arc.center.y + arc.radius * Math.sin(angle),
  };
}

export function strokeStart(stroke: Stroke): Point {
  return segStart(stroke[0]);
}

export function strokeEnd(stroke: Stroke): Point {
  return segEnd(stroke[stroke.length - 1]);
}

export function reverseSegment(seg: Segment): Segment {
  if (seg.type === 'line') {
    return { type: 'line', from: seg.to, to: seg.from };
  }
  return {
    type: 'arc',
    center: seg.center,
    radius: seg.radius,
    startAngle: seg.endAngle,
    endAngle: seg.startAngle,
    ccw: !seg.ccw,
  };
}

export function reverseStroke(stroke: Stroke): Stroke {
  return stroke.slice().reverse().map(reverseSegment);
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
