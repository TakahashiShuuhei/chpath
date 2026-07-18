import type { LayoutResult } from './layout';

/** 生成された直線・円弧のコマンド一覧を、コピーしやすいプレーンテキストにする */
export function describeCommands(layout: LayoutResult): string {
  const lines: string[] = [];
  layout.strokes.forEach((stroke, strokeIndex) => {
    lines.push(`# stroke ${strokeIndex + 1}`);
    for (const seg of stroke) {
      if (seg.type === 'line') {
        lines.push(`L (${fmt(seg.from.x)}, ${fmt(seg.from.y)}) -> (${fmt(seg.to.x)}, ${fmt(seg.to.y)})`);
      } else {
        lines.push(
          `A center=(${fmt(seg.center.x)}, ${fmt(seg.center.y)}) r=${fmt(seg.radius)} ` +
            `angle=${fmt(seg.startAngle)}->${fmt(seg.endAngle)} ${seg.ccw ? 'ccw' : 'cw'}`,
        );
      }
    }
  });
  return lines.join('\n');
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}
