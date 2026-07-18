import type { Segment, Stroke } from './types';

/** 拡大縮小+平行移動(相似変換)のみを想定した変換。回転は使わないため角度はそのまま */
export function transformStroke(stroke: Stroke, scale: number, dx: number, dy: number): Stroke {
  return stroke.map((seg) => transformSegment(seg, scale, dx, dy));
}

function transformSegment(seg: Segment, scale: number, dx: number, dy: number): Segment {
  if (seg.type === 'line') {
    return {
      type: 'line',
      from: { x: seg.from.x * scale + dx, y: seg.from.y * scale + dy },
      to: { x: seg.to.x * scale + dx, y: seg.to.y * scale + dy },
    };
  }
  return {
    ...seg,
    center: { x: seg.center.x * scale + dx, y: seg.center.y * scale + dy },
    radius: seg.radius * scale,
  };
}
