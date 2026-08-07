'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { qrPathFor, qrSymbolFor, qrViewBoxSize } from '../domain/qr';

/**
 * The share URL as a scannable symbol — one `<path>`, no canvas, no image.
 *
 * Rendered on the *client* and not on the server, which is forced by the same
 * property that makes the whole feature safe: the raw token exists only in
 * `createShareLinkAction`'s return value, so the only place that can encode it
 * is the component holding that value. Nothing is fetched and nothing is
 * uploaded — the encoder runs in the browser (see `../domain/qr`), so the token
 * never travels anywhere it was not already going.
 *
 * `currentColor` on the path means the symbol inverts with the theme. The white
 * background rect is not decorative: a scanner needs a light quiet zone, and a
 * dark-mode page without it produces a symbol that no phone will read.
 *
 * The `aria-label` is a fixed, localized string (NB-8) — not `url`. The share
 * URL is a bearer token; a screen reader announcing it, or a browser's
 * accessibility tree exposing it in the DOM's accessible name, is one more
 * place the credential ends up outside the link and the QR it names.
 */
export function ShareQr({ url, size = 176 }: { url: string; size?: number }) {
  const t = useTranslations('sharing');
  const { path, viewBox } = useMemo(() => {
    const symbol = qrSymbolFor(url);
    return { path: qrPathFor(symbol), viewBox: qrViewBoxSize(symbol) };
  }, [url]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      role="img"
      aria-label={t('created.qrLabel')}
      data-testid="share-qr"
      className="rounded-lg bg-white"
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#000" />
    </svg>
  );
}
