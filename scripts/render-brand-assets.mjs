import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const paper = [0xf3, 0xed, 0xe4, 255];
const accent = [0xc4, 0x49, 0x2c, 255];
const ink = [0x1c, 0x19, 0x15, 255];
const clear = [0, 0, 0, 0];

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(raw, start + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function stamp(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fill(pixels, size, box, color) {
  const left = Math.round(box.x * size);
  const top = Math.round(box.y * size);
  const right = Math.round((box.x + box.w) * size);
  const bottom = Math.round((box.y + box.h) * size);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) stamp(pixels, size, x, y, color);
  }
}

function render(size, mode) {
  const pixels = new Uint8Array(size * size * 4);
  const background = mode === 'foreground' || mode === 'mono' || mode === 'splash' ? clear : paper;
  const mark = mode === 'mono' ? [255, 255, 255, 255] : accent;
  const base = mode === 'mono' ? [255, 255, 255, 255] : ink;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = background[0];
    pixels[index + 1] = background[1];
    pixels[index + 2] = background[2];
    pixels[index + 3] = background[3];
  }
  if (mode !== 'background') {
    fill(pixels, size, { x: 0.4, y: 0.16, w: 0.2, h: 0.56 }, mark);
    fill(pixels, size, { x: 0.28, y: 0.74, w: 0.44, h: 0.06 }, base);
  }
  return png(size, size, pixels);
}

writeFileSync('assets/icon.png', render(1024, 'icon'));
writeFileSync('assets/splash-icon.png', render(512, 'splash'));
writeFileSync('assets/android-icon-foreground.png', render(1024, 'foreground'));
writeFileSync('assets/android-icon-background.png', render(512, 'background'));
writeFileSync('assets/android-icon-monochrome.png', render(512, 'mono'));
