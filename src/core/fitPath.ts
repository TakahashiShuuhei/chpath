import type { ArcSeg, Glyph, GlyphSource, Point, Segment, Stroke } from './types';
import { dist } from './types';
import { type Cubic, sampleCubic } from './bezier';

export type RawLine = { type: 'line'; from: Point; to: Point };
export type RawCubic = { type: 'cubic' } & Cubic;
export type RawSeg = RawLine | RawCubic;

const SAMPLES_PER_CUBIC = 12;
const SUBDIVISIONS_PER_LINE = 5;
const DEDUPE_EPS = 1e-6;

/**
 * 1本のサブパス(直線+3次ベジエの連なり)を点列に平坦化する。
 * 元データが折れ線で曲線を近似している場合(Hershey等)も、曲線をベジエで
 * 表している場合(KanjiVG等)も、この点列に落とし込めば同じアルゴリズムで
 * 直線/円弧にフィットできる。tolerance に依存しないため、ビルド時に
 * 一度だけ計算して保存しておける。
 */
export function flattenStroke(raw: RawSeg[]): Point[] {
  return dedupe(flatten(raw));
}

/**
 * 平坦化済みの点列を、誤差許容値`tolerance`以内でできるだけ少ない
 * 直線・円弧に変換する。tolerance はUIから動的に変更されうるため、
 * この関数は実行時(ブラウザ側)で呼ぶことを想定している。
 */
export function fitPointsToStroke(points: Point[], tolerance: number): Stroke {
  if (points.length < 2) return [];
  const segments = fitPoints(points, tolerance);
  return mergeAdjacent(segments, tolerance);
}

/** 便宜上のラッパー: サブパスから直接フィット済みストロークを得る */
export function fitStroke(raw: RawSeg[], tolerance: number): Stroke {
  return fitPointsToStroke(flattenStroke(raw), tolerance);
}

/** 生データ(GlyphSource)を指定の許容誤差でフィットし、描画可能なGlyphを得る */
export function fitGlyph(source: GlyphSource, tolerance: number): Glyph {
  return {
    char: source.char,
    advance: source.advance,
    strokes: source.strokes
      .map((pts) => fitPointsToStroke(pts, tolerance))
      .filter((s) => s.length > 0),
  };
}

function flatten(raw: RawSeg[]): Point[] {
  if (raw.length === 0) return [];
  const points: Point[] = [raw[0].from];
  for (const r of raw) {
    if (r.type === 'line') {
      // 直線区間も細かく分割して点を補う。元データの点数が少ない場合
      // (Hershey等)、区間の「途中」に誤差チェック用の点が無いと、
      // 両端の2〜3点だけを通る円弧が誤差0で「完璧に一致」してしまい、
      // 実際には点と点の間で大きく膨らんだり、鋭い角を滑らかな弧に
      // すり替えてしまったりする(点が足りないと直線と円は3点あれば
      // 必ず区別なく通ってしまうため)。
      for (let i = 1; i <= SUBDIVISIONS_PER_LINE; i++) {
        const t = i / SUBDIVISIONS_PER_LINE;
        points.push({ x: r.from.x + (r.to.x - r.from.x) * t, y: r.from.y + (r.to.y - r.from.y) * t });
      }
    } else {
      const samples = sampleCubic(r, SAMPLES_PER_CUBIC);
      for (let i = 1; i < samples.length; i++) points.push(samples[i]);
    }
  }
  return points;
}

function dedupe(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const prev = result[result.length - 1];
    if (!prev || dist(prev, p) > DEDUPE_EPS) result.push(p);
  }
  return result;
}

function fitPoints(points: Point[], tolerance: number): Segment[] {
  const p0 = points[0];
  const p1 = points[points.length - 1];

  if (points.length <= 2) {
    return [{ type: 'line', from: p0, to: p1 }];
  }

  const lineErr = maxDistanceFromChord(points, p0, p1);
  if (lineErr <= tolerance) {
    return [{ type: 'line', from: p0, to: p1 }];
  }

  if (points.length === 3) {
    // 点が3つしかない場合、中間点を含む3点は円が幾何学的に必ず誤差0で
    // 通ってしまい、それが本当に円弧なのか単に鋭い角(直線同士の接続点)
    // なのかを円弧フィッティングでは判別できない。直線1本では収まらない
    // と分かった以上、ここでは中間点を角とみなして2本の直線に分ける
    // (点が足りず円弧として検証できないケースなので、円弧化は行わない)。
    return [
      { type: 'line', from: p0, to: points[1] },
      { type: 'line', from: points[1], to: p1 },
    ];
  }

  const midIdx = Math.floor((points.length - 1) / 2);
  const arc = fitArc(p0, points[midIdx], p1);
  const arcErr = arc ? maxDistanceFromArc(points, arc) : Infinity;
  if (arc && arcErr <= tolerance) {
    return [arc];
  }

  // どちらも許容誤差に収まらない場合、最も誤差の大きい点で分割して再帰する
  // (arcの場合、半径方向の誤差だけでなく「startAngle~endAngleの範囲外に
  // 出てしまう点」も誤差Infinityとして扱い、優先的にそこで分割する)
  let splitIdx = midIdx;
  let worst = -Infinity;
  for (let i = 1; i < points.length - 1; i++) {
    const e = arc ? arcPointError(points[i], arc) : perpendicularDistance(points[i], p0, p1);
    if (e > worst) {
      worst = e;
      splitIdx = i;
    }
  }

  const left = fitPoints(points.slice(0, splitIdx + 1), tolerance);
  const right = fitPoints(points.slice(splitIdx), tolerance);
  return [...left, ...right];
}

function perpendicularDistance(p: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return dist(p, from);
  return Math.abs((p.x - from.x) * dy - (p.y - from.y) * dx) / len;
}

function maxDistanceFromChord(points: Point[], from: Point, to: Point): number {
  let max = 0;
  for (const p of points) {
    const d = perpendicularDistance(p, from, to);
    if (d > max) max = d;
  }
  return max;
}

/**
 * 点列が候補の円弧arcにどれだけ近いかを返す。各点の半径方向の誤差・
 * 角度範囲だけでなく、点の並び順どおりに角度が単調に進んでいるかも見る。
 *
 * 角度範囲チェックだけでは、鋭い角(直線同士の接続点)の近くにたまたま
 * 小さな円が誤って当てはまってしまうケースを防げない。3点(始点・中間点・
 * 終点)から作った円は、点の並び順と円周上での角度の並び順が食い違って
 * いても(中間点が「始点から終点への短い側」ではなく「長い側」にあると
 * 判定されても)、その3点自体は誤差0で一致してしまう。結果、半径は小さい
 * のに円をほぼ1周(200度超)するような不自然な円弧が「許容誤差内」と
 * 誤判定され、角がちいさなループ状の弧に化けてしまうことがあった。
 * 点の角度が並び順どおりに単調に増加(または減少)しているかを追加で
 * チェックし、後退している場合はInfinityを返してこの弧を不適格とする。
 */
function maxDistanceFromArc(points: Point[], arc: ArcSeg): number {
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const totalSweep = arc.ccw ? norm(arc.endAngle - arc.startAngle) : norm(arc.startAngle - arc.endAngle);
  const MONOTONIC_EPS = 1e-6;

  let max = 0;
  let prevSweep = -Infinity;
  for (const p of points) {
    const radial = Math.abs(dist(p, arc.center) - arc.radius);
    const angle = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
    const sweepToP = arc.ccw ? norm(angle - arc.startAngle) : norm(arc.startAngle - angle);

    if (sweepToP > totalSweep + MONOTONIC_EPS) return Infinity; // 弧の範囲外
    if (sweepToP < prevSweep - MONOTONIC_EPS) return Infinity; // 角度が後退(単調でない)
    prevSweep = sweepToP;

    if (radial > max) max = radial;
  }
  return max;
}

/**
 * 点pが円弧arcにどれだけ近いかを返す。半径方向の距離だけでなく、
 * 角度がstartAngle~endAngleの範囲(ccwで決まる向き)に収まっているかも見る。
 * 範囲外(円の反対側など)にある場合はInfinityを返し、その弧が
 * 不適格であることを示す。これがないと、半径だけ合っていて実際には
 * 全く違う場所を指す弧(輪になった曲線で特に起きやすい)を許容してしまう。
 */
function arcPointError(p: Point, arc: ArcSeg): number {
  const radial = Math.abs(dist(p, arc.center) - arc.radius);

  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const totalSweep = arc.ccw ? norm(arc.endAngle - arc.startAngle) : norm(arc.startAngle - arc.endAngle);
  const angle = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  const sweepToP = arc.ccw ? norm(angle - arc.startAngle) : norm(arc.startAngle - angle);

  const OVERSHOOT_EPS = 1e-6;
  if (sweepToP > totalSweep + OVERSHOOT_EPS) return Infinity;
  return radial;
}

/** 始点・中間点・終点を通る円弧を求める(3点が共線に近い場合はnull) */
function fitArc(p0: Point, pMid: Point, p1: Point): ArcSeg | null {
  const center = circumcenter(p0, pMid, p1);
  if (!center) return null;
  const radius = dist(center, p0);
  if (!Number.isFinite(radius) || radius > 1e6) return null;

  const a0 = Math.atan2(p0.y - center.y, p0.x - center.x);
  const aMid = Math.atan2(pMid.y - center.y, pMid.x - center.x);
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);

  const ccw = isAngleBetweenCcw(a0, aMid, a1);

  return { type: 'arc', center, radius, startAngle: a0, endAngle: a1, ccw };
}

function circumcenter(p0: Point, p1: Point, p2: Point): Point | null {
  const ax = p0.x, ay = p0.y;
  const bx = p1.x, by = p1.y;
  const cx = p2.x, cy = p2.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null; // ほぼ共線 = 円が定義できない

  const ux =
    ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  return { x: ux, y: uy };
}

/** ccw方向(角度が増える方向)にa0から進んだときaMidがa1より先に現れるか */
function isAngleBetweenCcw(a0: number, aMid: number, a1: number): boolean {
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const dMid = norm(aMid - a0);
  const dEnd = norm(a1 - a0);
  return dMid <= dEnd;
}

function mergeAdjacent(segments: Segment[], tolerance: number): Segment[] {
  const result: Segment[] = [];
  for (const seg of segments) {
    const prev = result[result.length - 1];
    const merged = prev ? tryMerge(prev, seg, tolerance) : null;
    if (merged) {
      result[result.length - 1] = merged;
      continue;
    }
    result.push(seg);
  }
  return result;
}

function tryMerge(a: Segment, b: Segment, tolerance: number): Segment | null {
  if (a.type === 'line' && b.type === 'line') {
    const err = perpendicularDistance(a.to, a.from, b.to);
    if (err <= tolerance) {
      return { type: 'line', from: a.from, to: b.to };
    }
    return null;
  }
  if (a.type === 'arc' && b.type === 'arc') {
    const sameCenter = dist(a.center, b.center) <= tolerance;
    const sameRadius = Math.abs(a.radius - b.radius) <= tolerance;
    const continuous = anglesClose(a.endAngle, b.startAngle) && a.ccw === b.ccw;
    if (sameCenter && sameRadius && continuous) {
      return { ...a, endAngle: b.endAngle };
    }
    return null;
  }
  return null;
}

function anglesClose(a: number, b: number): boolean {
  const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const diff = Math.abs(norm(a) - norm(b));
  return diff < 1e-3 || Math.abs(diff - 2 * Math.PI) < 1e-3;
}
