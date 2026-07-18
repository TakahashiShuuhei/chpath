import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GlyphSource } from '../../src/core/types';
import { parseSvgPath } from '../../src/core/svgPath';
import { flattenStroke } from '../../src/core/fitPath';

const JOYO_LIST_URL =
  'https://raw.githubusercontent.com/rime-aca/character_set/master/%E5%B8%B8%E7%94%A8%E6%BC%A2%E5%AD%97%E8%A1%A8.txt';
const KANJIVG_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';
const CACHE_DIR = path.resolve(import.meta.dirname, '../.cache/kanjivg');
const CONCURRENCY = 16;

export async function loadTargetChars(): Promise<string[]> {
  const joyoText = await fetchTextCached(JOYO_LIST_URL, 'joyo.txt');
  const joyo = joyoText.split('\n').map((l) => l.trim()).filter(Boolean);

  const hiragana = range(0x3041, 0x3096);
  const katakana = [...range(0x30a1, 0x30fa), 0x30fc];

  return [...hiragana, ...katakana].map((c) => String.fromCodePoint(c)).concat(joyo);
}

export async function fetchKanjiVgGlyphs(chars: string[]): Promise<GlyphSource[]> {
  const results: (GlyphSource | null)[] = new Array(chars.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < chars.length) {
      const idx = cursor++;
      const ch = chars[idx];
      try {
        const svg = await fetchSvgCached(ch);
        results[idx] = svgToGlyphSource(ch, svg);
      } catch (e) {
        console.warn(`skip ${ch} (U+${ch.codePointAt(0)!.toString(16)}): ${(e as Error).message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results.filter((g): g is GlyphSource => g !== null);
}

function svgToGlyphSource(char: string, svg: string): GlyphSource {
  const [, vbW] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg) ?? [, '109', '109'];
  const scale = 1000 / Number(vbW);

  const pathDs = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  const strokes = pathDs
    .map((d) => scalePathString(d, scale))
    .flatMap((d) => parseSvgPath(d))
    .map((sp) => flattenStroke(sp))
    .filter((s) => s.length > 1);

  return { char, strokes, advance: 1000 };
}

function scalePathString(d: string, scale: number): string {
  return d.replace(/-?\d+(?:\.\d+)?/g, (m) => String(Number(m) * scale));
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

async function fetchSvgCached(char: string): Promise<string> {
  const hex = char.codePointAt(0)!.toString(16).padStart(5, '0');
  return fetchTextCached(`${KANJIVG_BASE}${hex}.svg`, `${hex}.svg`);
}

async function fetchTextCached(url: string, cacheName: string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheName);
  try {
    return await readFile(cachePath, 'utf-8');
  } catch {
    // キャッシュなし: フェッチする
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  await writeFile(cachePath, text, 'utf-8');
  return text;
}
