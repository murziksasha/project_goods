const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const publicDir = path.resolve(__dirname, '../public');

const crc32 = (buffer) => {
  let crc = ~0;

  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return ~crc >>> 0;
};

const createChunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
};

const writePng = (filePath, size, pixels) => {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    scanlines[rowOffset] = 0;
    pixels.copy(scanlines, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk('IHDR', ihdr),
    createChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
};

const isInsidePolygon = (x, y, polygon) => {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const xi = polygon[index][0];
    const yi = polygon[index][1];
    const xj = polygon[previous][0];
    const yj = polygon[previous][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const getDistanceToSegment = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const beforeSegment = vx * wx + vy * wy;

  if (beforeSegment <= 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const segmentLength = vx * vx + vy * vy;

  if (segmentLength <= beforeSegment) {
    return Math.hypot(px - bx, py - by);
  }

  const position = beforeSegment / segmentLength;
  return Math.hypot(px - (ax + position * vx), py - (ay + position * vy));
};

const getEdgeDistance = (x, y, polygon) => {
  let distance = Infinity;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    distance = Math.min(distance, getDistanceToSegment(x, y, start[0], start[1], end[0], end[1]));
  }

  return distance;
};

const renderIcon = (size, maskable) => {
  const pixels = Buffer.alloc(size * size * 4);
  const background = maskable ? [36, 54, 74, 255] : [0, 0, 0, 0];

  for (let index = 0; index < pixels.length; index += 4) {
    pixels.set(background, index);
  }

  const padding = maskable ? size * 0.19 : size * 0.1;
  const scale = Math.min((size - padding * 2) / 48, (size - padding * 2) / 46);
  const offsetX = (size - 48 * scale) / 2;
  const offsetY = (size - 46 * scale) / 2;
  const sourceBolt = [
    [10.9, 0],
    [39.8, 0],
    [31.8, 13.4],
    [46.5, 13.4],
    [24.9, 45],
    [24, 31.7],
    [10.3, 31.7],
    [17.4, 18.5],
    [1.2, 18.5],
  ];
  const sourceStripe = [
    [31, 7],
    [39, 13.5],
    [27, 31],
    [22, 28],
  ];
  const toCanvasPoint = ([x, y]) => [offsetX + x * scale, offsetY + y * scale];
  const bolt = sourceBolt.map(toCanvasPoint);
  const stripe = sourceStripe.map(toCanvasPoint);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pixelX = x + 0.5;
      const pixelY = y + 0.5;

      if (!isInsidePolygon(pixelX, pixelY, bolt)) {
        continue;
      }

      const alpha = Math.max(0, Math.min(255, getEdgeDistance(pixelX, pixelY, bolt) * 255));
      const color = isInsidePolygon(pixelX, pixelY, stripe)
        ? [71, 191, 255, 255]
        : maskable
          ? [237, 230, 255, 255]
          : [134, 59, 255, 255];
      const pixelIndex = (y * size + x) * 4;

      pixels[pixelIndex] = color[0];
      pixels[pixelIndex + 1] = color[1];
      pixels[pixelIndex + 2] = color[2];
      pixels[pixelIndex + 3] = maskable ? 255 : Math.min(color[3], Math.round(alpha));
    }
  }

  return pixels;
};

writePng(path.join(publicDir, 'pwa-192x192.png'), 192, renderIcon(192, false));
writePng(path.join(publicDir, 'pwa-512x512.png'), 512, renderIcon(512, false));
writePng(path.join(publicDir, 'pwa-maskable-512x512.png'), 512, renderIcon(512, true));

console.log('Generated PWA icons.');
