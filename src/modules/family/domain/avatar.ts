/**
 * Custom avatar validation (M20).
 *
 * A member's face is normally one of the eight built-in avatars — a path under
 * `/avatars/`, which is a closed set and needs no checking. M20 restores the
 * legacy capability of uploading your own (the getavataaars.com SVGs families
 * already had), stored inline in `member.avatarUrl` as a `data:` URI so there
 * is no blob store, no upload route and no migration.
 *
 * That makes this file the security boundary. An attacker who can write
 * arbitrary bytes into `avatarUrl` gets them served back to every member of the
 * household, so *everything* below is a whitelist and the default answer is no.
 *
 * Two properties hold the risk down, and both matter:
 *
 *  1. **Rendering is `<img src>` only.** An SVG loaded through `<img>` is in a
 *     separate, script-disabled document: no scripts run, no external
 *     subresources load, no access to the embedding page. Never render a member
 *     avatar with `dangerouslySetInnerHTML` — the legacy component did exactly
 *     that, which is why its uploads were a genuine XSS sink and these are not.
 *     Pinned by `tests/unit/avatar-svg.test.ts` and the picker's own markup.
 *
 *  2. **Allowlist parsing.** Rather than grepping for `<script>` (a blocklist,
 *     and therefore a list of the attacks somebody thought of), the markup is
 *     tokenised and every element and attribute must appear in the tables
 *     below. An unknown element, an unknown attribute, an `on*` handler, an
 *     `href` that is not a same-document `#fragment`, a `url(…)` that leaves
 *     the document, a DOCTYPE, a CDATA section or a raw entity is a rejection,
 *     not something to strip. Rejecting rather than sanitising is deliberate:
 *     the stored bytes are then always exactly the bytes that were validated,
 *     so there is no rewrite step whose output could differ from its input's
 *     verdict.
 *
 * Pure and dependency-free on purpose: the same function runs in the browser
 * (immediate feedback in the picker) and inside the Server Action's zod schema
 * (the one that actually decides).
 */

/** Legacy's cap, kept: 20 KB decoded. Big enough for getavataaars, small enough to inline. */
export const MAX_CUSTOM_AVATAR_BYTES = 20 * 1024;

/**
 * Character cap on the whole data URI, checked *before* anything is decoded so
 * an oversized payload is refused without allocating it.
 * Base64 is 4 characters per 3 bytes, plus room for the media-type prefix.
 */
export const MAX_CUSTOM_AVATAR_URI_LENGTH = Math.ceil((MAX_CUSTOM_AVATAR_BYTES * 4) / 3) + 64;

/**
 * What the file input accepts.
 *
 * SVG is the format the feature exists for. The three raster types ride along
 * because they cost one magic-byte comparison each and a parent with a cropped
 * photo should not be told "SVG only" — but note that 20 KB buys a rather small
 * bitmap, so SVG stays the advertised path.
 */
export const CUSTOM_AVATAR_MIME_TYPES = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type CustomAvatarMimeType = (typeof CUSTOM_AVATAR_MIME_TYPES)[number];

/** `accept` attribute for the file input, matching the list above. */
export const CUSTOM_AVATAR_ACCEPT =
  '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp';

export type AvatarRejection =
  /** Not a `data:<type>;base64,<payload>` URI at all. */
  | 'notDataUri'
  /** A data URI, but not one of `CUSTOM_AVATAR_MIME_TYPES`. */
  | 'unsupportedType'
  /** The base64 payload is malformed. */
  | 'notBase64'
  /** Over `MAX_CUSTOM_AVATAR_BYTES` decoded. */
  | 'tooLarge'
  /** The bytes do not match the declared type (magic bytes / unparseable SVG). */
  | 'contentMismatch'
  /** Parsed as SVG, but contains something outside the allowlist. */
  | 'disallowedSvgContent';

export type AvatarCheck =
  | { ok: true; mimeType: CustomAvatarMimeType; bytes: number }
  | { ok: false; reason: AvatarRejection };

/** A custom (uploaded) avatar, as opposed to one of the built-in `/avatars/…` paths. */
export function isCustomAvatarUrl(value: string): boolean {
  return value.startsWith('data:');
}

/**
 * The whole check, in the order that fails cheapest first.
 *
 * @param value the candidate `member.avatarUrl`
 */
export function checkCustomAvatar(value: string): AvatarCheck {
  if (value.length > MAX_CUSTOM_AVATAR_URI_LENGTH) return { ok: false, reason: 'tooLarge' };

  const match =
    /^data:([a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(
      value
    );
  if (!match) return { ok: false, reason: 'notDataUri' };

  const declared = match[1].toLowerCase();
  if (!(CUSTOM_AVATAR_MIME_TYPES as readonly string[]).includes(declared)) {
    return { ok: false, reason: 'unsupportedType' };
  }
  const mimeType = declared as CustomAvatarMimeType;

  const bytes = decodeBase64(match[2]);
  if (!bytes) return { ok: false, reason: 'notBase64' };
  if (bytes.length === 0) return { ok: false, reason: 'contentMismatch' };
  if (bytes.length > MAX_CUSTOM_AVATAR_BYTES) return { ok: false, reason: 'tooLarge' };

  if (mimeType === 'image/svg+xml') {
    let markup: string;
    try {
      markup = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, reason: 'contentMismatch' };
    }

    const svg = checkSvgMarkup(markup);
    if (!svg.ok) return svg;
  } else if (!hasMagicBytes(mimeType, bytes)) {
    // A declared type the bytes do not back up is the classic way to smuggle
    // markup past a type check, so the declaration is never taken on trust.
    return { ok: false, reason: 'contentMismatch' };
  }

  return { ok: true, mimeType, bytes: bytes.length };
}

function decodeBase64(payload: string): Uint8Array | null {
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/** File signatures. WebP is a RIFF container, so both halves are checked. */
function hasMagicBytes(mimeType: CustomAvatarMimeType, bytes: Uint8Array): boolean {
  const startsWith = (signature: readonly number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, index) => bytes[offset + index] === byte);

  switch (mimeType) {
    case 'image/png':
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return startsWith([0xff, 0xd8, 0xff]);
    case 'image/webp':
      return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8);
    default:
      return false;
  }
}

/* -------------------------------------------------------------------------- */
/* SVG allowlist                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Elements a member avatar may contain. Case-sensitive, because SVG is XML and
 * `linearGradient` is not `lineargradient`.
 *
 * Notable absentees and why: `script` and `foreignObject` (arbitrary code and
 * arbitrary HTML), `style` (a stylesheet can `@import`), `image` and `feImage`
 * (they take an `href` to fetch), `animate`/`set`/`animateTransform` (SMIL can
 * retarget an attribute at runtime, including `href`), `metadata` (a hole for
 * arbitrary foreign XML), `a` (navigable), `handler`, `audio`, `video`,
 * `iframe`, `embed`, `object`.
 */
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'switch',
  // shapes
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  // text
  'text',
  'tspan',
  // paint servers and clipping
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'marker',
  // filters (the ones that take no href)
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'feTurbulence',
]);

/**
 * Attributes any allowed element may carry. One flat table rather than a
 * per-element matrix: the elements are already constrained, and an attribute
 * that is harmless on `path` is harmless on `rect`. Presentation attributes
 * only — nothing here fetches, navigates or executes.
 *
 * `href`/`xlink:href` are present but are additionally required to be
 * same-document fragments (see `isSafeAttributeValue`).
 */
const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set([
  // structure / a11y
  'id',
  'class',
  'style',
  'transform',
  'role',
  'focusable',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'xml:space',
  'xmlns',
  'xmlns:xlink',
  'version',
  'baseProfile',
  'href',
  'xlink:href',
  // geometry
  'd',
  'points',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'dx',
  'dy',
  'width',
  'height',
  'viewBox',
  'preserveAspectRatio',
  'pathLength',
  'overflow',
  // paint
  'fill',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'clip-path',
  'mask',
  'mask-type',
  'filter',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'display',
  'visibility',
  'shape-rendering',
  'vector-effect',
  'paint-order',
  'mix-blend-mode',
  'isolation',
  'enable-background',
  // text
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'word-spacing',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  // gradients / patterns / masks / markers
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'maskUnits',
  'maskContentUnits',
  'clipPathUnits',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'refX',
  'refY',
  'orient',
  // filters
  'filterUnits',
  'primitiveUnits',
  'in',
  'in2',
  'result',
  'mode',
  'operator',
  'type',
  'values',
  'stdDeviation',
  'radius',
  'k1',
  'k2',
  'k3',
  'k4',
  'flood-color',
  'flood-opacity',
  'tableValues',
  'slope',
  'intercept',
  'amplitude',
  'exponent',
  'baseFrequency',
  'numOctaves',
  'seed',
  'stitchTiles',
]);

/** The only namespace URIs an avatar may declare. */
const SVG_NAMESPACES: ReadonlySet<string> = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
]);

type Rejected = { ok: false; reason: AvatarRejection };
type Accepted = { ok: true };

const disallowed: Rejected = { ok: false, reason: 'disallowedSvgContent' };
const malformed: Rejected = { ok: false, reason: 'contentMismatch' };

/**
 * Tokenise the markup and hold every element and attribute against the tables
 * above. Not a full XML parser — it does not need to build a tree, only to
 * refuse anything it cannot account for, and "cannot account for" is the
 * failure mode it defaults to.
 */
export function checkSvgMarkup(source: string): Accepted | Rejected {
  // Entities are how encoded payloads sneak past value checks (`&#106;avascript:`),
  // and a custom entity is how a DOCTYPE becomes a billion-laughs. Only the five
  // predefined ones survive.
  if (/&(?!(?:amp|lt|gt|quot|apos);)/.test(source)) return disallowed;

  const stack: string[] = [];
  let root: string | null = null;
  let index = 0;

  while (index < source.length) {
    const next = source.indexOf('<', index);
    if (next === -1) break;

    // Character data between tags. Harmless by construction (any `<` would have
    // opened a tag), and entities were rejected above.
    index = next;

    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      if (end === -1) return malformed;
      index = end + 3;
      continue;
    }

    // `<!DOCTYPE …>` (external entities, entity expansion) and `<![CDATA[…]]>`
    // (script bodies hide there) are both refused outright.
    if (source.startsWith('<!', index)) return disallowed;

    if (source.startsWith('<?', index)) {
      // The XML declaration is fine; any other processing instruction is not —
      // and `<?xml-stylesheet href="…"?>` is *another* one, not a longer
      // spelling of this one. The target ends where the declaration's name
      // ends, so the next character must be whitespace or the closing `?`;
      // anything else is a different target wearing the prefix.
      const after = source[index + 5];
      if (!source.startsWith('<?xml', index) || after === undefined) return disallowed;
      if (!/[\s?]/.test(after)) return disallowed;
      const end = source.indexOf('?>', index + 2);
      if (end === -1) return malformed;
      index = end + 2;
      continue;
    }

    if (source.startsWith('</', index)) {
      const end = source.indexOf('>', index);
      if (end === -1) return malformed;
      const name = source.slice(index + 2, end).trim();
      if (stack.pop() !== name) return malformed;
      index = end + 1;
      continue;
    }

    const parsed = parseStartTag(source, index);
    if (!parsed) return malformed;
    if (parsed.verdict) return parsed.verdict;

    root ??= parsed.name;
    if (!parsed.selfClosing) stack.push(parsed.name);
    index = parsed.end;
  }

  if (stack.length > 0) return malformed;
  // An avatar is an SVG document. Anything whose outermost element is something
  // else is not one, whatever its media type claimed.
  if (root !== 'svg') return malformed;

  return { ok: true };
}

type StartTag = { name: string; selfClosing: boolean; end: number; verdict: Rejected | null };

function parseStartTag(source: string, start: number): StartTag | null {
  const nameMatch = /^<([A-Za-z_][\w.:-]*)/.exec(source.slice(start));
  if (!nameMatch) return null;

  const name = nameMatch[1];
  let index = start + nameMatch[0].length;
  const reject = (verdict: Rejected, end: number): StartTag => ({
    name,
    selfClosing: true,
    end,
    verdict,
  });

  if (!ALLOWED_ELEMENTS.has(name)) {
    // Still find the tag's end so the caller has a defined position, though the
    // verdict short-circuits anyway.
    const end = source.indexOf('>', index);
    return reject(disallowed, end === -1 ? source.length : end + 1);
  }

  for (;;) {
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (index >= source.length) return null;

    if (source[index] === '>') return { name, selfClosing: false, end: index + 1, verdict: null };
    if (source.startsWith('/>', index)) {
      return { name, selfClosing: true, end: index + 2, verdict: null };
    }

    const attribute = /^([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(source.slice(index));
    // Every attribute must be `name="value"`. A bare attribute, or an unquoted
    // value, is markup this parser will not guess at.
    if (!attribute) return null;

    const attributeName = attribute[1];
    const value = attribute[2] ?? attribute[3] ?? '';
    index += attribute[0].length;

    // Spelled out even though the allowlist already excludes them: an event
    // handler is the thing this whole file exists to keep out, and a future
    // edit that widens the table should not be able to let one in by accident.
    if (attributeName.toLowerCase().startsWith('on')) {
      return reject(disallowed, index);
    }
    if (!ALLOWED_ATTRIBUTES.has(attributeName)) {
      return reject(disallowed, index);
    }
    if (!isSafeAttributeValue(attributeName, value)) {
      return reject(disallowed, index);
    }
  }
}

/**
 * Value-level rules for attributes that are on the allowlist but can still
 * point somewhere.
 *
 * The one invariant: an avatar is *self-contained*. Nothing in it may cause a
 * fetch, because a fetch is both a tracking beacon (it fires for every family
 * member who views the roster) and the loophole that turns a static image into
 * a live document.
 */
function isSafeAttributeValue(name: string, value: string): boolean {
  // Whitespace and control characters are removed rather than matched around:
  // `java\tscript:` and a NUL-separated one are both live in a browser, so
  // neither may break up a token the checks below look for.
  const normalized = Array.from(value)
    .filter((character) => character.charCodeAt(0) > 0x20 && character.charCodeAt(0) !== 0x7f)
    .join('')
    .toLowerCase();

  // Namespace declarations are the one place a URL is legitimate — and it is
  // not a URL the renderer ever fetches, it is an identifier compared as a
  // string. Only the two SVG namespaces are recognised, so this stays a
  // whitelist rather than a hole in the "no external references" rule.
  if (name === 'xmlns' || name === 'xmlns:xlink') {
    return SVG_NAMESPACES.has(value.trim());
  }

  if (name === 'href' || name === 'xlink:href') {
    // Same-document references only — this is what stops `<use href="https://…">`.
    return /^#[\w.:-]+$/.test(value.trim());
  }

  if (/^(javascript|vbscript|data):/.test(normalized)) return false;
  if (/(^|[^\w])(https?:)?\/\//.test(normalized)) return false;

  if (name === 'style') {
    // A style attribute cannot carry a selector, but it can carry an @import,
    // a legacy `expression()`, or a `url()` to anywhere.
    //
    // Those three are matched literally, which only works if the text is
    // literal. CSS lets any character be written as a backslash escape
    // (`\75rl(` is `url(`), so a blocklist read on the raw string is defeated
    // by spelling. Rather than decode escapes — which is a second parser, and
    // this file's whole thesis is not to run one — a backslash is refused
    // outright: a declaration an avatar has any business carrying (`fill`,
    // `opacity`, `stroke-width`) never needs one.
    if (value.includes('\\')) return false;
    if (/@import|expression\(|behavior:|url\(/.test(normalized)) return false;
    return true;
  }

  // `fill`, `stroke`, `clip-path`, `mask`, `filter` and friends take FuncIRIs.
  // Only the same-document form survives.
  if (normalized.includes('url(')) {
    return /^url\(#[\w.:-]+\)$/.test(normalized);
  }

  return true;
}
