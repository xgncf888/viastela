import { expect, test } from '@jest/globals';

import { brand } from '@/config/brand';

import { SERIF_FONT_FILE, SERIF_FONT_MAX_BYTES, SERIF_GLYPHS } from './serif-glyphs';

type FsModule = { readFileSync: (path: string) => Uint8Array };
type ZlibModule = { brotliDecompressSync: (data: Uint8Array) => Uint8Array };

declare const require: {
  (id: 'node:fs'): FsModule;
  (id: 'node:zlib'): ZlibModule;
};

// The app has no @types/node. These reads stay in the test, not the native bundle.
const fs = require('node:fs');
const zlib = require('node:zlib');

/** WOFF2 known table tags. Index 63 means the tag is stored inline. */
const KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
];

function u16(data: Uint8Array, offset: number): number {
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

function u32(data: Uint8Array, offset: number): number {
  return (
    (((data[offset] ?? 0) << 24) |
      ((data[offset + 1] ?? 0) << 16) |
      ((data[offset + 2] ?? 0) << 8) |
      (data[offset + 3] ?? 0)) >>>
    0
  );
}

function i16(data: Uint8Array, offset: number): number {
  const value = u16(data, offset);
  return value > 0x7fff ? value - 0x10000 : value;
}

function ascii(data: Uint8Array, start: number, end: number): string {
  let text = '';
  for (let index = start; index < end; index += 1) text += String.fromCharCode(data[index] ?? 0);
  return text;
}

function readBase128(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  for (let i = 0; i < 5; i += 1) {
    if (offset >= data.length) throw new Error('truncated base128');
    const byte = data[offset] ?? 0;
    offset += 1;
    if (i === 0 && byte === 0x80) throw new Error('invalid base128');
    result = (result << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return [result >>> 0, offset];
  }
  throw new Error('base128 too long');
}

function tableDataLength(tag: string, flags: number, origLength: number, data: Uint8Array, offset: number): [number, number] {
  const version = flags >> 6;
  const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
  if (!transformed) return [origLength, offset];
  return readBase128(data, offset);
}

/** Unicode scalar values with a non-zero glyph id in the font's cmap. */
export function woff2CmapCodepoints(file: Uint8Array): number[] {
  if (ascii(file, 0, 4) !== 'wOF2') throw new Error('not a woff2 font');
  const numTables = u16(file, 12);
  const totalCompressed = u32(file, 20);
  let offset = 48;
  const tables: { tag: string; length: number }[] = [];
  for (let index = 0; index < numTables; index += 1) {
    const flags = file[offset] ?? 0;
    offset += 1;
    const tagIndex = flags & 0x3f;
    let tag: string;
    if (tagIndex === 63) {
      tag = ascii(file, offset, offset + 4);
      offset += 4;
    } else {
      const known = KNOWN_TAGS[tagIndex];
      if (!known) throw new Error(`unknown woff2 tag ${tagIndex}`);
      tag = known;
    }
    let origLength: number;
    [origLength, offset] = readBase128(file, offset);
    let length: number;
    [length, offset] = tableDataLength(tag, flags, origLength, file, offset);
    tables.push({ tag, length });
  }
  const raw = zlib.brotliDecompressSync(file.subarray(offset, offset + totalCompressed));
  let cursor = 0;
  let cmap: Uint8Array | null = null;
  for (const table of tables) {
    const slice = raw.subarray(cursor, cursor + table.length);
    if (slice.length !== table.length) throw new Error(`short ${table.tag} table`);
    if (table.tag === 'cmap') cmap = slice;
    cursor += table.length;
  }
  if (!cmap) throw new Error('cmap table missing');
  if (cursor !== raw.length) throw new Error(`woff2 table bytes ${cursor} != ${raw.length}`);
  return cmapCodepoints(cmap);
}

function cmapCodepoints(cmap: Uint8Array): number[] {
  const numTables = u16(cmap, 2);
  let chosen = 0;
  let chosenScore = -1;
  for (let index = 0; index < numTables; index += 1) {
    const platform = u16(cmap, 4 + index * 8);
    const encoding = u16(cmap, 6 + index * 8);
    const subOffset = u32(cmap, 8 + index * 8);
    const format = u16(cmap, subOffset);
    let score = 0;
    if (platform === 0) score += 3;
    if (platform === 3 && (encoding === 1 || encoding === 10)) score += 4;
    if (format === 12) score += 2;
    if (format === 4) score += 1;
    if (score > chosenScore) {
      chosen = subOffset;
      chosenScore = score;
    }
  }
  const format = u16(cmap, chosen);
  const points = new Set<number>();
  if (format === 4) {
    const segCount = u16(cmap, chosen + 6) / 2;
    const endCount = chosen + 14;
    const startCount = endCount + segCount * 2 + 2;
    const idDelta = startCount + segCount * 2;
    const idRangeOffset = idDelta + segCount * 2;
    for (let index = 0; index < segCount; index += 1) {
      const end = u16(cmap, endCount + index * 2);
      const start = u16(cmap, startCount + index * 2);
      const delta = i16(cmap, idDelta + index * 2);
      const rangeOffset = u16(cmap, idRangeOffset + index * 2);
      if (start === 0xffff) continue;
      for (let code = start; code <= end; code += 1) {
        let glyphId: number;
        if (rangeOffset === 0) {
          glyphId = (code + delta) & 0xffff;
        } else {
          const glyphPos = idRangeOffset + index * 2 + rangeOffset + (code - start) * 2;
          glyphId = u16(cmap, glyphPos);
          if (glyphId !== 0) glyphId = (glyphId + delta) & 0xffff;
        }
        if (glyphId !== 0) points.add(code);
      }
    }
  } else if (format === 12) {
    const groups = u32(cmap, chosen + 12);
    let pos = chosen + 16;
    for (let index = 0; index < groups; index += 1) {
      const start = u32(cmap, pos);
      const end = u32(cmap, pos + 4);
      const startGlyph = u32(cmap, pos + 8);
      pos += 12;
      for (let code = start; code <= end; code += 1) {
        if (startGlyph + (code - start) !== 0) points.add(code);
      }
    }
  } else {
    throw new Error(`unsupported cmap format ${format}`);
  }
  return [...points].sort((left, right) => left - right);
}

function containsAscii(data: Uint8Array, text: string): boolean {
  const needle = [...text].map((char) => char.charCodeAt(0));
  for (let index = 0; index <= data.length - needle.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (data[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

test('the web serif subset matches the glyph list and stays within 200KB', () => {
  const bytes = fs.readFileSync(SERIF_FONT_FILE);
  const license = new TextDecoder().decode(fs.readFileSync('public/fonts/OFL.txt'));
  expect(bytes.length).toBeGreaterThan(0);
  expect(bytes.length).toBeLessThanOrEqual(SERIF_FONT_MAX_BYTES);
  expect(containsAscii(bytes, brand.displayName)).toBe(false);
  expect(license).toContain('SIL OPEN FONT LICENSE');
  expect(license.includes(brand.displayName)).toBe(false);
  const found = woff2CmapCodepoints(bytes)
    .map((code) => String.fromCodePoint(code))
    .join('');
  const expected = [...SERIF_GLYPHS].sort().join('');
  expect(found).toBe(expected);
});
