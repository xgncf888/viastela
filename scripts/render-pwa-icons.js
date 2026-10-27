const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { deflateSync, inflateSync } = require('node:zlib');

const SCRIPT_VERSION = '2';

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
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`expected 8-bit RGBA PNG, received bit depth ${bitDepth} color type ${colorType}`);
  }
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source];
    source += 1;
    const row = y * stride;
    for (let index = 0; index < stride; index += 1) {
      const raw = inflated[source];
      source += 1;
      const left = index >= 4 ? pixels[row + index - 4] : 0;
      const up = y > 0 ? pixels[row - stride + index] : 0;
      const upLeft = index >= 4 && y > 0 ? pixels[row - stride + index - 4] : 0;
      let value = raw;
      if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
      pixels[row + index] = value;
    }
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

function recolorBackground(pixels, width, height, background, paper) {
  const next = Buffer.from(pixels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const distance =
        Math.abs(next[index] - background[0]) +
        Math.abs(next[index + 1] - background[1]) +
        Math.abs(next[index + 2] - background[2]);
      if (next[index + 3] < 16 || distance <= 18) {
        next[index] = paper[0];
        next[index + 1] = paper[1];
        next[index + 2] = paper[2];
        next[index + 3] = 255;
      }
    }
  }
  return next;
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

/**
 * Export installed-icon sizes from assets/icon.png.
 * Maskable art is the full mark scaled into the center 80% circle when the
 * source mark extends past that safe zone. Returns whether the source already fit.
 */
function renderPwaIcons({ source, outDir, splashes, paper }) {
  mkdirSync(outDir, { recursive: true });
  const sourceBytes = readFileSync(source);
  const stamp = createHash('sha256').update(SCRIPT_VERSION).update(sourceBytes).update(JSON.stringify(splashes)).update(paper).digest('hex');
  const stampPath = path.join(outDir, '.stamp');
  const required = [
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
    ...splashes.map((splash) => `apple-splash-${splash.width}x${splash.height}.png`),
  ];
  if (existsSync(stampPath) && readFileSync(stampPath, 'utf8') === stamp && required.every((name) => existsSync(path.join(outDir, name)))) {
    const saved = JSON.parse(readFileSync(path.join(outDir, 'maskable.json'), 'utf8'));
    return saved;
  }

  const decoded = decodePng(sourceBytes);
  const measured = contentRadius(decoded.pixels, decoded.width, decoded.height);
  const fits = measured.bounds !== null && measured.farthest <= measured.safeRadius + 0.5;
  const icon192 = resize(decoded.pixels, decoded.width, decoded.height, 192, 192);
  const icon512 = resize(decoded.pixels, decoded.width, decoded.height, 512, 512);
  const apple = resize(decoded.pixels, decoded.width, decoded.height, 180, 180);

  const maskable = Buffer.alloc(512 * 512 * 4);
  const paperRgb = parseHex(paper);
  fill(maskable, paperRgb);
  // The safe zone is the center circle with diameter 80% of the canvas.
  // Scale the whole source so its farthest mark pixel lands inside that circle.
  const scale = fits ? 1 : Math.min(1, (512 * 0.4) / (measured.farthest * (512 / decoded.width)));
  const markSize = Math.max(1, Math.round(512 * scale));
  const paperSource = recolorBackground(decoded.pixels, decoded.width, decoded.height, measured.background, paperRgb);
  const mark = resize(paperSource, decoded.width, decoded.height, markSize, markSize);
  const offset = Math.floor((512 - markSize) / 2);
  blit(maskable, 512, mark, markSize, markSize, offset, offset);

  writeIfChanged(path.join(outDir, 'icon-192.png'), encodePng(192, 192, icon192));
  writeIfChanged(path.join(outDir, 'icon-512.png'), encodePng(512, 512, icon512));
  writeIfChanged(path.join(outDir, 'icon-maskable-512.png'), encodePng(512, 512, maskable));
  writeIfChanged(path.join(outDir, 'apple-touch-icon.png'), encodePng(180, 180, apple));

  const iconPoint = 120;
  for (const splash of splashes) {
    const canvas = Buffer.alloc(splash.width * splash.height * 4);
    fill(canvas, paperRgb);
    const iconSize = iconPoint * splash.ratio;
    const splashIcon = resize(paperSource, decoded.width, decoded.height, iconSize, iconSize);
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

  const report = {
    fitsSafeZone: fits,
    farthest: Number(measured.farthest.toFixed(2)),
    safeRadius: Number(measured.safeRadius.toFixed(2)),
    bounds: measured.bounds,
    source: `${decoded.width}x${decoded.height}`,
    scaledTo: fits ? 1 : Number(scale.toFixed(4)),
  };
  writeFileSync(path.join(outDir, 'maskable.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(stampPath, stamp);
  return report;
}

module.exports = { renderPwaIcons };

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
    source: path.resolve('assets/icon.png'),
    outDir: path.resolve('public/icons'),
    splashes: pwaSplashes,
    paper: theme.color.paper,
  });
  console.log(JSON.stringify(report));
}
