import qrcode from 'qrcode-generator';

/**
 * A QR symbol as pure data, plus an SVG path for it.
 *
 * **Why a dependency and not a hand-rolled encoder.** M11 hand-rolled a PNG
 * rasteriser rather than take a dependency, and the same instinct applies here
 * — but the two are not the same problem. A rasteriser's output is validated by
 * looking at it: if the icon is wrong, you can see that it is wrong. A QR
 * symbol's output is validated only by a *decoder*: Reed–Solomon error
 * correction over GF(256), eight mask patterns scored against four penalty
 * rules, and BCH-encoded format bits produce a grid that looks perfectly
 * plausible while scanning as nothing at all — and the error correction is
 * precisely what hides a small encoding bug until the day a phone is held at a
 * slight angle. Writing an encoder means writing a decoder to test it, which is
 * a larger surface than the encoder.
 *
 * `qrcode-generator` is the reference JavaScript implementation (Kazuhiko
 * Arase, MIT), has **zero transitive dependencies**, and ships its own type
 * declarations — the three properties that made hand-rolling worth it in M11
 * are the ones this package already has.
 *
 * What is *not* delegated is rendering: `createSvgTag()` emits one `<rect>` per
 * dark module (hundreds of elements) and a raw HTML string, neither of which
 * belongs in a React tree. `qrPathFor()` below emits a single path `d`, which
 * a component renders as one `<path>` inside its own JSX.
 *
 * Framework-free per §2 rule 2 — no React, no DOM, no database — so the encoder
 * is unit-testable in plain Node and works identically on the server and in the
 * client component that shows a freshly minted token.
 */

export type QrSymbol = {
  /** Modules per side, excluding the quiet zone. */
  count: number;
  /** `matrix[row][col]` — true is a dark module. */
  matrix: boolean[][];
};

/**
 * Error correction level.
 *
 * `M` (~15% recovery) rather than `L`: a share QR is photographed off a phone
 * screen by a grandparent, often at an angle and sometimes off a screenshot
 * that has been through a messaging app. `Q`/`H` would buy more tolerance at
 * the cost of a denser symbol, and density is the thing that actually defeats a
 * low-resolution camera at the sizes this renders at.
 */
const ERROR_CORRECTION = 'M' as const;

/** Quiet zone in modules. The spec's minimum is 4; anything less scans poorly. */
export const QR_QUIET_ZONE = 4;

/**
 * Encode a string into a QR symbol.
 *
 * Type number `0` lets the encoder pick the smallest version that fits, so a
 * short share URL produces a coarse, easily-scanned symbol instead of a fixed
 * dense one.
 */
export function qrSymbolFor(text: string): QrSymbol {
  const qr = qrcode(0, ERROR_CORRECTION);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];

  for (let row = 0; row < count; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < count; col += 1) line.push(qr.isDark(row, col));
    matrix.push(line);
  }

  return { count, matrix };
}

/**
 * The `viewBox` side length for a symbol: the modules plus a quiet zone on both
 * sides. One module is one user unit, so the path below needs no scaling —
 * the SVG element's own width does the work.
 */
export function qrViewBoxSize(symbol: QrSymbol): number {
  return symbol.count + QR_QUIET_ZONE * 2;
}

/**
 * A single SVG path `d` covering every dark module.
 *
 * Horizontal runs are merged into one rectangle each, which typically cuts the
 * subpath count by well over half — a scanner sees the same symbol, and the
 * DOM sees one element instead of several hundred.
 */
export function qrPathFor(symbol: QrSymbol): string {
  const parts: string[] = [];

  for (let row = 0; row < symbol.count; row += 1) {
    let col = 0;
    while (col < symbol.count) {
      if (!symbol.matrix[row][col]) {
        col += 1;
        continue;
      }

      let run = 1;
      while (col + run < symbol.count && symbol.matrix[row][col + run]) run += 1;

      const x = col + QR_QUIET_ZONE;
      const y = row + QR_QUIET_ZONE;
      parts.push(`M${x} ${y}h${run}v1h-${run}z`);

      col += run;
    }
  }

  return parts.join('');
}
