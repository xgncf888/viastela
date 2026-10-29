const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { deflateSync, inflateSync } = require('node:zlib');

const SCRIPT_VERSION = '4';

// Scheme C icons are Diana's committed files. This script only paints the apple
// startup images from the committed apple-touch icon, so the mark has one source.
const COMMITTED_ICONS = [
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
];

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

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    pixels.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4);
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

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePng(buffer) {
  if (buffer[0] !== 137 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('icon source is not a PNG');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[10] !== 0) throw new Error('PNG compression is not deflate');
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`expected 8-bit RGB or RGBA PNG, received bit depth ${bitDepth} color type ${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const raw = Buffer.alloc(width * height * channels);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source];
    source += 1;
    const row = y * stride;
    for (let index = 0; index < stride; index += 1) {
      const byte = inflated[source];
      source += 1;
      const left = index >= channels ? raw[row + index - channels] : 0;
      const up = y > 0 ? raw[row - stride + index] : 0;
      const upLeft = index >= channels && y > 0 ? raw[row - stride + index - channels] : 0;
      let value = byte;
      if (filter === 1) value = (byte + left) & 255;
      else if (filter === 2) value = (byte + up) & 255;
      else if (filter === 3) value = (byte + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (byte + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
      raw[row + index] = value;
    }
  }
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const from = index * channels;
    const to = index * 4;
    pixels[to] = raw[from];
    pixels[to + 1] = raw[from + 1];
    pixels[to + 2] = raw[from + 2];
    pixels[to + 3] = channels === 4 ? raw[from + 3] : 255;
  }
  return { width, height, pixels };
}

function resize(source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const pixels = Buffer.alloc(targetWidth * targetHeight * 4);
  const xRatio = sourceWidth / targetWidth;
  const yRatio = sourceHeight / targetHeight;
  for (let y = 0; y < targetHeight; y += 1) {
    const yStart = y * yRatio;
    const yEnd = (y + 1) * yRatio;
    const top = Math.floor(yStart);
    const bottom = Math.min(sourceHeight, Math.ceil(yEnd));
    for (let x = 0; x < targetWidth; x += 1) {
      const xStart = x * xRatio;
      const xEnd = (x + 1) * xRatio;
      const left = Math.floor(xStart);
      const right = Math.min(sourceWidth, Math.ceil(xEnd));
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let weight = 0;
      for (let sampleY = top; sampleY < bottom; sampleY += 1) {
        const yWeight = Math.min(sampleY + 1, yEnd) - Math.max(sampleY, yStart);
        for (let sampleX = left; sampleX < right; sampleX += 1) {
          const sampleWeight = yWeight * (Math.min(sampleX + 1, xEnd) - Math.max(sampleX, xStart));
          const index = (sampleY * sourceWidth + sampleX) * 4;
          red += source[index] * sampleWeight;
          green += source[index + 1] * sampleWeight;
          blue += source[index + 2] * sampleWeight;
          alpha += source[index + 3] * sampleWeight;
          weight += sampleWeight;
        }
      }
      const index = (y * targetWidth + x) * 4;
      pixels[index] = Math.round(red / weight);
      pixels[index + 1] = Math.round(green / weight);
      pixels[index + 2] = Math.round(blue / weight);
      pixels[index + 3] = Math.round(alpha / weight);
    }
  }
  return pixels;
}

function contentRadius(pixels, width, height) {
  const background = [pixels[0], pixels[1], pixels[2]];
  let farthest = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (pixels[index + 3] < 16) continue;
      const distance =
        Math.abs(pixels[index] - background[0]) +
        Math.abs(pixels[index + 1] - background[1]) +
        Math.abs(pixels[index + 2] - background[2]);
      if (distance <= 18) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const fromCenter = Math.hypot(x - centerX, y - centerY);
      if (fromCenter > farthest) farthest = fromCenter;
    }
  }
  return {
    farthest,
    safeRadius: width * 0.4,
    bounds: maxX < 0 ? null : { minX, minY, maxX, maxY },
    background,
  };
}

function fill(pixels, color) {
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = color[3];
  }
}

function blit(target, targetWidth, source, sourceWidth, sourceHeight, left, top) {
  for (let y = 0; y < sourceHeight; y += 1) {
    const destination = ((top + y) * targetWidth + left) * 4;
    source.copy(target, destination, y * sourceWidth * 4, (y + 1) * sourceWidth * 4);
  }
}

function parseHex(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255,
  ];
}

function writeIfChanged(file, bytes) {
  if (existsSync(file) && readFileSync(file).equals(bytes)) return;
  writeFileSync(file, bytes);
}

function pixelAt(pixels, width, x, y) {
  const index = (y * width + x) * 4;
  return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
}

function readPng(file) {
  return decodePng(readFileSync(file));
}

/**
 * Paint apple startup images from the committed apple-touch icon.
 * Does not write the installed icon files.
 */
function renderPwaIcons({ source, outDir, splashes, paper }) {
  // App config loads this on every export, before Expo copies public/ into dist.
  require('./stamp-pwa-html.js').preparePwaPublicFiles();
  mkdirSync(outDir, { recursive: true });
  for (const name of COMMITTED_ICONS) {
    if (!existsSync(path.join(outDir, name))) throw new Error(`committed PWA icon missing: ${name}`);
  }
  const sourceBytes = readFileSync(source);
  const maskablePath = path.join(outDir, 'icon-maskable-512.png');
  const maskableBytes = readFileSync(maskablePath);
  const stamp = createHash('sha256')
    .update(SCRIPT_VERSION)
    .update(sourceBytes)
    .update(maskableBytes)
    .update(JSON.stringify(splashes))
    .update(paper)
    .digest('hex');
  const stampPath = path.join(outDir, '.stamp');
  const splashNames = splashes.map((splash) => `apple-splash-${splash.width}x${splash.height}.png`);
  if (
    existsSync(stampPath) &&
    readFileSync(stampPath, 'utf8') === stamp &&
    splashNames.every((name) => existsSync(path.join(outDir, name))) &&
    existsSync(path.join(outDir, 'maskable.json'))
  ) {
    return JSON.parse(readFileSync(path.join(outDir, 'maskable.json'), 'utf8'));
  }

  const decoded = decodePng(sourceBytes);
  const paperRgb = parseHex(paper);
  const iconPoint = 120;
  for (const splash of splashes) {
    const canvas = Buffer.alloc(splash.width * splash.height * 4);
    fill(canvas, paperRgb);
    const iconSize = iconPoint * splash.ratio;
    const splashIcon = resize(decoded.pixels, decoded.width, decoded.height, iconSize, iconSize);
    blit(
      canvas,
      splash.width,
      splashIcon,
      iconSize,
      iconSize,
      Math.round((splash.width - iconSize) / 2),
      Math.round((splash.height - iconSize) / 2),
    );
    writeIfChanged(path.join(outDir, `apple-splash-${splash.width}x${splash.height}.png`), encodePng(splash.width, splash.height, canvas));
  }

  const maskable = decodePng(maskableBytes);
  const measured = contentRadius(maskable.pixels, maskable.width, maskable.height);
  const report = {
    fitsSafeZone: measured.bounds !== null && measured.farthest <= measured.safeRadius + 0.5,
    farthest: Number(measured.farthest.toFixed(2)),
    safeRadius: Number(measured.safeRadius.toFixed(2)),
    bounds: measured.bounds,
    source: `${maskable.width}x${maskable.height}`,
    scaledTo: 1,
  };
  writeFileSync(path.join(outDir, 'maskable.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(stampPath, stamp);
  return report;
}

function pngCorner(file) {
  const { pixels } = readPng(file);
  return [pixels[0], pixels[1], pixels[2], pixels[3]];
}

function pngCorners(file) {
  const { width, height, pixels } = readPng(file);
  return [
    pixelAt(pixels, width, 0, 0),
    pixelAt(pixels, width, width - 1, 0),
    pixelAt(pixels, width, 0, height - 1),
    pixelAt(pixels, width, width - 1, height - 1),
  ];
}

function pngInset(file, fraction) {
  const { width, height, pixels } = readPng(file);
  return pixelAt(pixels, width, Math.round(width * fraction), Math.round(height * fraction));
}

module.exports = { renderPwaIcons, pngCorner, pngCorners, pngInset };

if (require.main === module) {
  const fs = require('node:fs');
  const Module = require('node:module');
  const ts = require('typescript');
  if (!Module._extensions['.ts']) {
    Module._extensions['.ts'] = function loadTypeScript(module, filename) {
      const source = fs.readFileSync(filename, 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      });
      module._compile(outputText, filename);
    };
  }
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function resolveTypeScript(request, parent, isMain, options) {
    if (parent?.filename?.endsWith('.ts') && request.startsWith('.')) {
      try {
        return resolveFilename.call(this, `${request}.ts`, parent, isMain, options);
      } catch {
        // A relative import can still be a directory or a .js file.
      }
    }
    return resolveFilename.call(this, request, parent, isMain, options);
  };
  const { theme } = require('../src/ui/theme.ts');
  const { pwaSplashes } = require('../src/config/pwa.ts');
  const report = renderPwaIcons({
    source: path.resolve('public/icons/apple-touch-icon.png'),
    outDir: path.resolve('public/icons'),
    splashes: pwaSplashes,
    paper: theme.color.paper,
  });
  console.log(JSON.stringify(report));
}
