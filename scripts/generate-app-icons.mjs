#!/usr/bin/env node
/**
 * Rasterise the Kynite brand mark into the PNG sizes a web app manifest needs
 * for installability.
 *
 * The mark is `docs/design/assets/logo-icon.svg`, which itself transcribes the
 * CSS recipe in `docs/design/brand.md` § "Icon / App icon": a 120×120 rounded
 * square (radius 28) filled `oklch(58% 0.14 245)`, two 112px circles clipped
 * inside it (`oklch(58% 0.14 335)` top-left and `#5d5fef` bottom-right, both at
 * 85% alpha), and a centred white Material "star" glyph.
 *
 * Hand-rolled rather than a dependency: the mark is a rounded square, two
 * circles and one straight-edged polygon, the output is four small files that
 * change roughly never, and no SVG rasteriser on this machine understands
 * `oklch()` anyway. `zlib` is in Node; PNG is four chunks. The Oklch→sRGB
 * conversion below is the CSS Color 4 formula, so the PNGs land on exactly the
 * colours the stylesheet paints rather than on a hand-copied approximation.
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

/* -- Colour ---------------------------------------------------------------- */

/** CSS Color 4 Oklch → linear sRGB → gamma sRGB, clipped to gamut. */
function oklch(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const linear = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];

  return linear.map((v) => {
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, g)) * 255);
  });
}

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

/** brand.md § "Icon / App icon" — every value quoted from the recipe. */
const BASE = oklch(0.58, 0.14, 245); // container background
const BLOB_A = oklch(0.58, 0.14, 335); // top-left circle, 85% alpha
const BLOB_B = hex('#5d5fef'); // bottom-right circle, 85% opacity
const GLYPH = [0xff, 0xff, 0xff]; // the star
const BLOB_ALPHA = 0.85;

/* -- Geometry, in the mark's own 120×120 user space ------------------------ */

const SPACE = 120;
const CORNER_RADIUS = 28;
const BLOB_RADIUS = 56; // a 112px circle
const BLOB_A_CENTRE = [18, 26]; // left:-38px; top:-30px
const BLOB_B_CENTRE = [105, 102]; // right:-41px; bottom:-38px

/**
 * The Material Icons "star" (filled) outline. The published path is entirely
 * straight line segments, so it is exactly this 10-vertex polygon in the
 * glyph's own 24×24 box; the SVG places it at translate(23, 24.23) scale(3.0833).
 */
const STAR_TRANSLATE = [23, 24.23];
const STAR_SCALE = 3.0833;
const STAR_POINTS = [
  [12, 17.27],
  [18.18, 21],
  [16.54, 13.97],
  [22, 9.24],
  [14.81, 8.63],
  [12, 2],
  [9.19, 8.63],
  [2, 9.24],
  [7.46, 13.97],
  [5.82, 21],
].map(([x, y]) => [STAR_TRANSLATE[0] + x * STAR_SCALE, STAR_TRANSLATE[1] + y * STAR_SCALE]);

const SAMPLES = 4; // 4×4 supersampling — the circles need more than the old mark did

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance-based rounded-rect test: outside the corner arc is outside the box. */
function insideRoundedRect(x, y, size, radius) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  if (radius <= 0) return true;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  if (x === cx || y === cy) return true; // straight edge region
  return Math.hypot(x - cx, y - cy) <= radius;
}

/** src over dst, both opaque RGB triples. */
function over(dst, src, alpha) {
  return dst.map((v, i) => v * (1 - alpha) + src[i] * alpha);
}

/** The mark's colour at one point in user space, or null outside the clip. */
function sample(x, y, radius) {
  if (!insideRoundedRect(x, y, SPACE, radius)) return null;

  let colour = BASE.slice();
  if (Math.hypot(x - BLOB_A_CENTRE[0], y - BLOB_A_CENTRE[1]) <= BLOB_RADIUS) {
    colour = over(colour, BLOB_A, BLOB_ALPHA);
  }
  if (Math.hypot(x - BLOB_B_CENTRE[0], y - BLOB_B_CENTRE[1]) <= BLOB_RADIUS) {
    colour = over(colour, BLOB_B, BLOB_ALPHA);
  }
  if (pointInPolygon(x, y, STAR_POINTS)) colour = GLYPH.slice();
  return colour;
}

/**
 * @param {number} size    output edge in px
 * @param {object} options
 * @param {number} options.radius  corner radius in user space (0 = square)
 * @param {number} options.scale   composition scale about the centre (maskable safe zone)
 */
function render(size, { radius, scale }) {
  const rgba = Buffer.alloc(size * size * 4);
  const unit = SPACE / size;
  const centre = SPACE / 2;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let hits = 0;
      const sum = [0, 0, 0];

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = centre + ((px + (sx + 0.5) / SAMPLES) * unit - centre) / scale;
          const y = centre + ((py + (sy + 0.5) / SAMPLES) * unit - centre) / scale;
          const colour = sample(x, y, radius);
          if (!colour) continue;
          hits += 1;
          for (let c = 0; c < 3; c += 1) sum[c] += colour[c];
        }
      }

      const total = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 4;
      if (hits === 0) {
        // Outside the mark. Maskable icons must be full-bleed, so the ground
        // there is the base indigo rather than transparent.
        if (scale < 1) {
          for (let c = 0; c < 3; c += 1) rgba[offset + c] = BASE[c];
          rgba[offset + 3] = 255;
        }
        continue;
      }
      for (let c = 0; c < 3; c += 1) rgba[offset + c] = Math.round(sum[c] / hits);
      rgba[offset + 3] = scale < 1 ? 255 : Math.round((hits / total) * 255);
      if (scale < 1 && hits < total) {
        // Blend the mark's edge into the full-bleed ground instead of leaving a
        // hard alpha step the mask would clip anyway.
        const cover = hits / total;
        for (let c = 0; c < 3; c += 1) {
          rgba[offset + c] = Math.round((sum[c] / hits) * cover + BASE[c] * (1 - cover));
        }
      }
    }
  }

  return rgba;
}

/* -- PNG ------------------------------------------------------------------- */

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
  // Apple applies its own squircle mask, so the source is a full square.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 1 },
  // Maskable: full bleed, content inside the 80% safe zone Android crops to.
  { file: 'maskable-512.png', size: 512, radius: 0, scale: 0.7 },
  // Browser tab / bookmark raster fallback for `favicon.svg`.
  { file: 'favicon-96.png', size: 96, radius: CORNER_RADIUS, scale: 1 },
];

mkdirSync(outDir, { recursive: true });

for (const { file, size, radius, scale } of TARGETS) {
  const png = toPng(render(size, { radius, scale }), size);
  writeFileSync(join(outDir, file), png);
  console.log(
    `${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KiB  ${createHash('sha256').update(png).digest('hex').slice(0, 12)}`
  );
}
