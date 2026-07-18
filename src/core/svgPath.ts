import type { Point } from './types';
import type { RawSeg } from './fitPath';

/** SVGのd属性をパースし、サブパス(M区切り)ごとのRawSeg配列を返す */
export function parseSvgPath(d: string): RawSeg[][] {
  const tokens = tokenize(d);
  let i = 0;
  const next = (): string => tokens[i++];
  const hasNext = (): boolean => i < tokens.length && !isCommand(tokens[i]);

  const subpaths: RawSeg[][] = [];
  let current: RawSeg[] = [];
  let start: Point = { x: 0, y: 0 };
  let cur: Point = { x: 0, y: 0 };
  let prevCubicC2: Point | null = null;
  let prevQuadC: Point | null = null;
  let cmd = '';

  const pushLine = (to: Point) => {
    current.push({ type: 'line', from: cur, to });
    cur = to;
  };
  const pushCubic = (c1: Point, c2: Point, to: Point) => {
    current.push({ type: 'cubic', from: cur, c1, c2, to });
    cur = to;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (isCommand(t)) {
      cmd = next();
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    switch (C) {
      case 'M': {
        const x = Number(next());
        const y = Number(next());
        const p = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        if (current.length > 0) subpaths.push(current);
        current = [];
        start = p;
        cur = p;
        prevCubicC2 = null;
        prevQuadC = null;
        break;
      }
      case 'L': {
        const x = Number(next());
        const y = Number(next());
        pushLine(rel ? { x: cur.x + x, y: cur.y + y } : { x, y });
        prevCubicC2 = null;
        prevQuadC = null;
        break;
      }
      case 'H': {
        const x = Number(next());
        pushLine({ x: rel ? cur.x + x : x, y: cur.y });
        prevCubicC2 = null;
        prevQuadC = null;
        break;
      }
      case 'V': {
        const y = Number(next());
        pushLine({ x: cur.x, y: rel ? cur.y + y : y });
        prevCubicC2 = null;
        prevQuadC = null;
        break;
      }
      case 'C': {
        const x1 = Number(next()), y1 = Number(next());
        const x2 = Number(next()), y2 = Number(next());
        const x = Number(next()), y = Number(next());
        const c1 = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        const c2 = rel ? { x: cur.x + x2, y: cur.y + y2 } : { x: x2, y: y2 };
        const to = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        pushCubic(c1, c2, to);
        prevCubicC2 = c2;
        prevQuadC = null;
        break;
      }
      case 'S': {
        const x2 = Number(next()), y2 = Number(next());
        const x = Number(next()), y = Number(next());
        const c1 = prevCubicC2 ? reflect(prevCubicC2, cur) : cur;
        const c2 = rel ? { x: cur.x + x2, y: cur.y + y2 } : { x: x2, y: y2 };
        const to = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        pushCubic(c1, c2, to);
        prevCubicC2 = c2;
        prevQuadC = null;
        break;
      }
      case 'Q': {
        const x1 = Number(next()), y1 = Number(next());
        const x = Number(next()), y = Number(next());
        const qc = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        const to = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        const [c1, c2] = quadToCubicControls(cur, qc, to);
        pushCubic(c1, c2, to);
        prevQuadC = qc;
        prevCubicC2 = null;
        break;
      }
      case 'T': {
        const x = Number(next()), y = Number(next());
        const reflectedQc: Point = prevQuadC ? reflect(prevQuadC, cur) : cur;
        const to = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        const [c1, c2] = quadToCubicControls(cur, reflectedQc, to);
        pushCubic(c1, c2, to);
        prevQuadC = reflectedQc;
        prevCubicC2 = null;
        break;
      }
      case 'Z': {
        pushLine(start);
        prevCubicC2 = null;
        prevQuadC = null;
        break;
      }
      default:
        // 未対応コマンド(A等)は現状想定していないので読み飛ばす
        while (hasNext()) next();
        break;
    }
  }
  if (current.length > 0) subpaths.push(current);
  return subpaths;
}

function reflect(p: Point, about: Point): Point {
  return { x: 2 * about.x - p.x, y: 2 * about.y - p.y };
}

function quadToCubicControls(from: Point, qc: Point, to: Point): [Point, Point] {
  const c1 = { x: from.x + (2 / 3) * (qc.x - from.x), y: from.y + (2 / 3) * (qc.y - from.y) };
  const c2 = { x: to.x + (2 / 3) * (qc.x - to.x), y: to.y + (2 / 3) * (qc.y - to.y) };
  return [c1, c2];
}

const COMMAND_LETTERS = new Set('MmLlHhVvCcSsQqTtAaZz'.split(''));
function isCommand(tok: string): boolean {
  return tok.length === 1 && COMMAND_LETTERS.has(tok);
}

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const re = /[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.\d+(?:e-?\d+)?|-?\d+(?:e-?\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}
