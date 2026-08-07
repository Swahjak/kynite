#!/usr/bin/env node
/**
 * Rasterise the Kynite mark (public/favicon.svg) into the PNG sizes a web app
 * manifest needs for installability (M11).
 *
 * Hand-rolled rather than a dependency: the mark is a rounded square plus one
 * stroked polygon, the output is four small files that change roughly never,
 * and adding an image toolchain to a build that currently needs none would
 * cost more than the ~120 lines below. `zlib` is in Node; PNG is four chunks.
 *
 * Run: `node scripts/generate-app-icons.mjs`
 */
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/icons');

/** The mark, in the favicon's own 400×400 user space. */
const BRAND = [0x13, 0xec, 0x92];
const STAR = [0xd4, 0xa8, 0x4b];
const CORNER_RADIUS = 60;
const STROKE = 40; // half of the SVG's stroke-width: 80, round join
const STAR_POINTS = [
  [200, 68],
  [238, 158],
  [336, 158],
  [258, 217],
  [285, 315],
  [200, 255],
  [115, 315],
  [142, 217],
  [64, 158],
  [162, 158],
];

const SAMPLES = 3; // 3×3 supersampling — enough for a 192px icon to look clean

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment(x, y, [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

/** The stroked polygon: inside it, or within half the stroke width of an edge. */
function inStar(x, y, points, stroke) {
  if (pointInPolygon(x, y, points)) return true;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    if (distanceToSegment(x, y, points[j], points[i]) <= stroke) return true;
  }
  return false;
}

function inRoundedRect(x, y, size, radius) {
  if (radius <= 0) return x >= 0 && y >= 0 && x <= size && y <= size;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (
    Math.hypot(x - cx, y - cy) <= radius ||
    (x >= radius && x <= size - radius) ||
    (y >= radius && y <= size - radius)
  );
}

/**
 * @param {number} size    output edge in px
 * @param {object} options
 * @param {number} options.radius  corner radius in user space (0 = square)
 * @param {number} options.scale   star scale about the centre (maskable safe zone)
 */
function render(size, { radius, scale }) {
  const rgba = Buffer.alloc(size * size * 4);
  const unit = 400 / size;
  const points = STAR_POINTS.map(([x, y]) => [200 + (x - 200) * scale, 200 + (y - 200) * scale]);
  const stroke = STROKE * scale;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let bg = 0;
      let fg = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = (px + (sx + 0.5) / SAMPLES) * unit;
          const y = (py + (sy + 0.5) / SAMPLES) * unit;
          if (!inRoundedRect(x, y, 400, radius)) continue;
          bg += 1;
          if (inStar(x, y, points, stroke)) fg += 1;
        }
      }

      const total = SAMPLES * SAMPLES;
      const alpha = Math.round((bg / total) * 255);
      const mix = bg === 0 ? 0 : fg / bg;
      const offset = (py * size + px) * 4;
      for (let c = 0; c < 3; c += 1) {
        rgba[offset + c] = Math.round(BRAND[c] * (1 - mix) + STAR[c] * mix);
      }
      rgba[offset + 3] = alpha;
    }
  }

  return rgba;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function toPng(rgba, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none — the images are tiny and flat
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, radius: CORNER_RADIUS, scale: 1 },
  { file: 'icon-512.png', size: 512, radius: CORNER_RADIUS, scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 1 },
  // Maskable: full bleed, content inside the 80% safe zone Android crops to.
  { file: 'maskable-512.png', size: 512, radius: 0, scale: 0.62 },
];

mkdirSync(outDir, { recursive: true });

for (const { file, size, radius, scale } of TARGETS) {
  const png = toPng(render(size, { radius, scale }), size);
  writeFileSync(join(outDir, file), png);
  console.log(
    `${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KiB  ${createHash('sha256').update(png).digest('hex').slice(0, 12)}`
  );
}
