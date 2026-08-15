#!/usr/bin/env node
/**
 * Prebuild guard for the icon subset (M02 carry-forward).
 *
 * `scripts/subset-icons.mjs` ships only the glyphs the source asks for, which
 * creates exactly one new failure mode: add `<Icon name="rocket_launch" />`,
 * forget to re-run the subsetter, and it renders as *nothing*. No type error,
 * no test failure, no console warning — a blank space where an icon should be.
 *
 * So the build refuses. This compares the icons the source renders against the
 * manifest the subsetter wrote, and fails on any difference. It needs no font
 * and no network, which is what lets it run on every build.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { collectIconNames, MANIFEST } from './subset-icons.mjs';

const CODEPOINT_MODULE = new URL(
  '../../../packages/ui/src/components/icon-codepoints.ts',
  import.meta.url
);

const used = await collectIconNames();

if (!existsSync(MANIFEST)) {
  console.error(`Missing ${MANIFEST}. Run \`pnpm icons:subset\`.`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const shipped = new Set(manifest.icons ?? []);

const missing = used.filter((name) => !shipped.has(name));
// Not an error, but worth saying: unused glyphs are bytes on a kiosk's boot path.
const stale = [...shipped].filter((name) => !used.includes(name));

if (missing.length > 0) {
  console.error(
    `Icons used in source but not in the subset font: ${missing.join(', ')}.\n` +
      'They would render as blank. Run `pnpm icons:subset` and commit the result.'
  );
  process.exit(1);
}

if (stale.length > 0) {
  console.warn(`Subset carries ${stale.length} unused icon(s): ${stale.join(', ')}.`);
}

// The generated codepoint module is what the app actually renders from, so it
// has to agree with the font that was shipped alongside it. Typecheck already
// catches a *missing* name; this catches the other direction — a module left
// behind by a subset run that was never committed.
const generated = await readFile(CODEPOINT_MODULE, 'utf8');
const declared = [...generated.matchAll(/^ {2}([a-z0-9_]+):/gm)].map((match) => match[1]);

const undeclared = [...shipped].filter((name) => !declared.includes(name));
if (undeclared.length > 0) {
  console.error(
    `In the subset font but missing from icon-codepoints.ts: ${undeclared.join(', ')}.\n` +
      'Run `pnpm icons:subset` and commit both files together.'
  );
  process.exit(1);
}

console.log(
  `Icon subset covers all ${used.length} icons used in source, ` +
    `and icon-codepoints.ts declares all ${declared.length}.`
);
