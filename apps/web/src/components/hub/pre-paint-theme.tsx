'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { useRef } from 'react';
import { DARK_FROM_HOUR, DARK_UNTIL_HOUR, HUB_THEME_STORAGE_KEY } from './hub-theme';

const PRE_PAINT_THEME = `(function(){try{
var r=document.documentElement;
var m=localStorage.getItem(${JSON.stringify(HUB_THEME_STORAGE_KEY)})||'auto';
var h=new Date().getHours();
var clock=h>=${DARK_FROM_HOUR}||h<${DARK_UNTIL_HOUR};
var none=window.matchMedia('(prefers-color-scheme: no-preference)').matches;
var d=m==='dark'||(m==='auto'&&(none?clock:window.matchMedia('(prefers-color-scheme: dark)').matches));
r.classList.toggle('dark',d);
r.dataset.hubTheme=d?'dark':'light';
}catch(e){}})()`;

/**
 * The 6-foot scale and the theme are applied before first paint, not in an
 * effect. The script is injected into the server HTML stream only
 * (`useServerInsertedHTML`), never into the React tree: a `<script>` rendered
 * as a component makes React log "script tag while rendering" on every client
 * navigation into this layout, and the script has nothing to do after the
 * first load anyway (`useHubTheme` takes over from there).
 */
export function PrePaintTheme() {
  // Next calls every inserted-HTML callback on every streamed flush, so a
  // once-only flag keeps this to a single <script> per document.
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_THEME }} />;
  });
  return null;
}
