import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MAX_CUSTOM_AVATAR_BYTES,
  checkCustomAvatar,
  checkSvgMarkup,
  isCustomAvatarUrl,
} from '@/modules/family/domain/avatar';

/**
 * The custom-avatar gate (M20).
 *
 * Uploaded avatars are stored as `data:` URIs in `member.avatarUrl` and served
 * back to everyone in the household, so this is the file that decides what a
 * hostile upload can contain. Two things are being proved:
 *
 *  - a real getavataaars-style SVG — the format the feature exists to accept —
 *    is not collateral damage of the strictness;
 *  - every documented escape (script, foreign content, event handler, external
 *    reference, entity trickery, size) is refused *by the same function the
 *    Server Action calls*, not by the picker.
 *
 * The rejections assert only that the answer is "no". Which of the rejection
 * reasons applies is an implementation detail and pinning it would make the
 * parser harder to tighten later.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const toDataUri = (markup: string, mimeType = 'image/svg+xml') =>
  `data:${mimeType};base64,${Buffer.from(markup, 'utf8').toString('base64')}`;

/**
 * Trimmed from real getavataaars.com output: the `<defs>`/`<mask>`/`<use>`
 * idiom, a gradient, camelCased attribute names and a same-document FuncIRI.
 * If a tightening of the allowlist breaks this, it has broken the feature.
 */
const GETAVATAAARS_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="264px" height="280px" viewBox="0 0 264 280" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <title>Avataaar</title>
  <desc>Created with getavataaars.com</desc>
  <defs>
    <circle id="path-1" cx="120" cy="120" r="120"/>
    <linearGradient id="grad-1" x1="0%" y1="0%" x2="0%" y2="100%" gradientUnits="objectBoundingBox">
      <stop stop-color="#FFFFFF" stop-opacity="0.5" offset="0%"/>
      <stop stop-color="#000000" stop-opacity="0.1" offset="100%"/>
    </linearGradient>
    <mask id="mask-2" mask-type="alpha" maskUnits="userSpaceOnUse" fill="white">
      <use xlink:href="#path-1"/>
    </mask>
  </defs>
  <g id="Avataaar" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
    <g transform="translate(-825.000000, -1100.000000)" mask="url(#mask-2)">
      <path d="M12,160 L152,160 L152,290 L12,290 Z" fill="#D0C6AC" fill-rule="nonzero"/>
      <ellipse cx="72" cy="80" rx="36" ry="40" fill="url(#grad-1)" opacity="0.75"/>
      <rect x="0" y="0" width="264" height="280" rx="8" style="mix-blend-mode:multiply"/>
      <text x="10" y="20" font-family="sans-serif" font-size="12" text-anchor="middle">Hi</text>
    </g>
  </g>
</svg>`;

const oversized = (): string => {
  // Padding lives in a `<desc>`, so the result is over the cap while remaining
  // markup this parser would otherwise happily accept — the size check is what
  // has to catch it.
  const padding = 'a'.repeat(MAX_CUSTOM_AVATAR_BYTES + 1024);
  return `<svg xmlns="http://www.w3.org/2000/svg"><desc>${padding}</desc></svg>`;
};

describe('checkSvgMarkup', () => {
  it('accepts a getavataaars-style avatar', () => {
    expect(checkSvgMarkup(GETAVATAAARS_SVG)).toEqual({ ok: true });
  });

  it('accepts a bare XML prolog', () => {
    // `GETAVATAAARS_SVG` carries one too, but stated on its own so the
    // processing-instruction rule below cannot be tightened into rejecting the
    // one PI an exported avatar legitimately arrives with.
    expect(
      checkSvgMarkup('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')
    ).toEqual({ ok: true });
  });

  it('accepts the built-in avatars this app already ships', () => {
    for (const name of ['fox', 'bear', 'cat', 'owl', 'rocket', 'star', 'flower', 'dino']) {
      const markup = readFileSync(resolve(root, `public/avatars/${name}.svg`), 'utf8');
      expect(checkSvgMarkup(markup), name).toEqual({ ok: true });
    }
  });

  it.each([
    ['a script element', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    [
      'a script element with no body',
      '<svg xmlns="http://www.w3.org/2000/svg"><script href="#x"/></svg>',
    ],
    [
      'foreignObject',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="10" height="10"><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject></svg>',
    ],
    ['an onload handler', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'],
    [
      'an onclick handler on a child',
      '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="1" onclick="alert(1)"/></svg>',
    ],
    [
      'a mixed-case OnLoad handler',
      '<svg xmlns="http://www.w3.org/2000/svg" OnLoad="alert(1)"></svg>',
    ],
    [
      'a javascript: href',
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/></svg>',
    ],
    [
      'an external use reference',
      '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="https://evil.example/x.svg#a"/></svg>',
    ],
    [
      'a protocol-relative reference',
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="//evil.example/x.svg#a"/></svg>',
    ],
    [
      'an external image',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/beacon.png" width="1" height="1"/></svg>',
    ],
    [
      'a style element with an import',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/x.css);</style></svg>',
    ],
    [
      'a style attribute with a remote url()',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" style="fill:url(https://evil.example/x.svg#a)"/></svg>',
    ],
    [
      'a remote FuncIRI fill',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="url(https://evil.example/x.svg#a)"/></svg>',
    ],
    [
      'a DOCTYPE with an external entity',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"></svg>',
    ],
    [
      'a CDATA section',
      '<svg xmlns="http://www.w3.org/2000/svg"><desc><![CDATA[<script>alert(1)</script>]]></desc></svg>',
    ],
    [
      'an entity-encoded javascript href',
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="&#106;avascript:alert(1)"/></svg>',
    ],
    [
      'an animate element retargeting href',
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"><animate attributeName="href" values="javascript:alert(1)"/></use></svg>',
    ],
    [
      'an anchor element',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://evil.example"><circle cx="1" cy="1" r="1"/></a></svg>',
    ],
    [
      // `<?xml` is a prefix of `<?xml-stylesheet`, so a guard that only checks
      // the prefix waves through a PI that attaches an external stylesheet.
      'an xml-stylesheet processing instruction',
      '<?xml-stylesheet href="data:text/css,*{}"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
    ],
    [
      // `\75rl(` is `url(` after CSS unescaping, which a literal blocklist
      // never sees.
      'a style attribute hiding url() behind a CSS escape',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" style="fill:\\75rl(//evil.example/x)"/></svg>',
    ],
    [
      // The same escape with a *relative* target, which the protocol-relative
      // rule above has no opinion about — only the "no backslashes in a style
      // value" rule catches this one, and a relative fetch is still a fetch.
      'a style attribute hiding a relative url() behind a CSS escape',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" style="fill:\\75rl(beacon.png)"/></svg>',
    ],
    ['markup whose root is not an svg', '<html><body>hi</body></html>'],
    ['an unknown attribute', '<svg xmlns="http://www.w3.org/2000/svg" formaction="x"></svg>'],
  ])('rejects %s', (_label, markup) => {
    expect(checkSvgMarkup(markup).ok).toBe(false);
  });
});

describe('checkCustomAvatar', () => {
  it('accepts a getavataaars data URI and reports its decoded size', () => {
    const result = checkCustomAvatar(toDataUri(GETAVATAAARS_SVG));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/svg+xml');
      expect(result.bytes).toBe(Buffer.byteLength(GETAVATAAARS_SVG, 'utf8'));
    }
  });

  it('rejects an SVG over the 20 KB cap', () => {
    expect(checkCustomAvatar(toDataUri(oversized()))).toEqual({ ok: false, reason: 'tooLarge' });
  });

  it('rejects a hostile SVG wrapped as a data URI', () => {
    const hostile = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

    expect(checkCustomAvatar(toDataUri(hostile))).toEqual({
      ok: false,
      reason: 'disallowedSvgContent',
    });
  });

  it('rejects anything that is not a base64 data URI', () => {
    for (const value of [
      '/avatars/fox.svg',
      'https://evil.example/avatar.svg',
      'data:image/svg+xml,<svg onload="alert(1)"/>',
      '',
    ]) {
      expect(checkCustomAvatar(value).ok, value).toBe(false);
    }
  });

  it('rejects a media type outside the allowlist', () => {
    expect(checkCustomAvatar(toDataUri('GIF89a', 'image/gif'))).toEqual({
      ok: false,
      reason: 'unsupportedType',
    });
  });

  describe('raster uploads', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const webp = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x1a, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 ', 'ascii'),
    ]);

    const uri = (bytes: Buffer, mimeType: string) =>
      `data:${mimeType};base64,${bytes.toString('base64')}`;

    it('accepts bytes matching the declared type', () => {
      expect(checkCustomAvatar(uri(png, 'image/png')).ok).toBe(true);
      expect(checkCustomAvatar(uri(jpeg, 'image/jpeg')).ok).toBe(true);
      expect(checkCustomAvatar(uri(webp, 'image/webp')).ok).toBe(true);
    });

    it('rejects bytes that contradict the declared type', () => {
      // The interesting case: markup smuggled in under a raster media type, so
      // that a viewer sniffing the content could still treat it as a document.
      expect(checkCustomAvatar(toDataUri('<svg xmlns="x"><script/></svg>', 'image/png'))).toEqual({
        ok: false,
        reason: 'contentMismatch',
      });
      expect(checkCustomAvatar(uri(png, 'image/jpeg')).ok).toBe(false);
      expect(checkCustomAvatar(uri(jpeg, 'image/webp')).ok).toBe(false);
    });
  });
});

describe('isCustomAvatarUrl', () => {
  it('separates uploads from the built-in set', () => {
    expect(isCustomAvatarUrl('/avatars/fox.svg')).toBe(false);
    expect(isCustomAvatarUrl(toDataUri(GETAVATAAARS_SVG))).toBe(true);
  });
});
