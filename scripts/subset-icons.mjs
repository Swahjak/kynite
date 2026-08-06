#!/usr/bin/env node
/**
 * Material Symbols subsetting (M02 carry-forward).
 *
 * The full variable font is 3.8 MB. Every glyph past the handful we actually
 * render is dead weight on a kiosk that has to boot to something useful with no
 * network, and on a phone on mobile data — so we ship only the icons the source
 * asks for.
 *
 * Mechanics: scan the source for `<Icon name="…" />` and for the token tables
 * that name icons indirectly (`EVENT_TYPE_ICONS` and friends), then subset the
 * font to those icons' glyphs.
 *
 * The subtlety is that Material Symbols ships as a *ligature* font: the classic
 * usage renders the icon's name as text and lets `liga` substitute the glyph.
 * That is unsubsettable in both directions, which is worth recording because
 * both dead ends look plausible:
 *
 *   - Subsetting by ligature *text* does almost nothing. Every name is spelled
 *     from the same 27 letters, so harfbuzz's layout closure finds all ~3,600
 *     icon glyphs reachable and keeps them (measured: 10 MB → 3.3 MB).
 *   - Subsetting by codepoint with `noLayoutClosure` shrinks correctly but
 *     breaks *some* icons and not others: the longer names substitute in
 *     stages through intermediate glyphs that are in no `cmap`, so closure-free
 *     subsetting drops them and the chain breaks. `local_fire_department` and
 *     `notifications` rendered as literal text while `calendar_month` was fine
 *     — a failure mode that is invisible in the byte count.
 *
 * So we do not use ligatures at all. Each icon is subset and rendered by its
 * PUA *codepoint*, and this script emits the name → codepoint map that
 * `components/ui/icon.tsx` renders from. Nothing depends on GSUB surviving,
 * which is what makes the result both tiny and correct.
 *
 * Run: `pnpm icons:subset`. Verified by `pnpm icons:check`, which `prebuild`
 * runs so a newly added icon cannot ship as a blank box.
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(root, 'src');
const FULL_FONT = join(root, 'src/styles/fonts/material-symbols-outlined-full.ttf');
const SUBSET_FONT = join(root, 'src/styles/fonts/material-symbols-outlined.woff2');
const MANIFEST = join(root, 'src/styles/fonts/material-symbols.manifest.json');
const CODEPOINT_MODULE = join(root, 'src/components/ui/icon-codepoints.ts');
const CODEPOINTS = join(root, 'scripts/material-symbols.codepoints');

/** Hard budget from the M02 review. Exceeding it fails rather than warns. */
export const BUDGET_BYTES = 50 * 1024;

/**
 * Icons named somewhere a static scan cannot see them as `<Icon name="…">`.
 *
 * Kept as an explicit list rather than by widening the regex: a scanner loose
 * enough to catch every indirection would also catch strings that are not icon
 * names at all, and silently bloat the subset. An entry here is a promise that
 * something renders it.
 */
const EXTRA_ICONS = [
  // modules/calendar/ui/tokens.ts — EVENT_TYPE_ICONS, indexed by event type.
  'event',
  'family_restroom',
  'redeem',
  'checklist',
  'cake',
  'label',
  // app/dev/design — ICON_SAMPLES, plus the theme toggle's conditional pair.
  'dashboard',
  'schedule',
  'settings',
  'notifications',
  'check',
  'location_on',
  'local_fire_department',
  'star',
  'timer',
  'light_mode',
  'dark_mode',
  // modules/rewards/ui/tokens.ts — REWARD_ICONS, rendered through
  // `rewardIconOf(reward.icon)` so no literal `name="…"` appears in source.
  // `redeem` and `star` are already above.
  'restaurant',
  'menu_book',
  'movie',
  'sports_esports',
  'cookie',
  'pets',
  'pool',
  'diversity_3',
  'icecream',
  'park',
  'palette',
];

const ICON_USAGE = /<Icon\b[^>]*?\bname=(?:"([a-z0-9_]+)"|\{'([a-z0-9_]+)'\}|'([a-z0-9_]+)')/g;

/**
 * Google's `name → hex codepoint` manifest for the same variable font.
 * Committed rather than fetched: a build that reaches the network to decide
 * which glyphs exist is a build that breaks offline and drifts silently.
 */
export async function loadCodepoints(path = CODEPOINTS) {
  const text = await readFile(path, 'utf8');
  const map = new Map();

  for (const line of text.split('\n')) {
    const [name, hex] = line.trim().split(/\s+/);
    if (name && hex) map.set(name, Number.parseInt(hex, 16));
  }

  return map;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (['.ts', '.tsx'].includes(extname(entry.name))) yield path;
  }
}

/** Every icon name the source renders, sorted and deduplicated. */
export async function collectIconNames(sourceDir = SOURCE_DIR) {
  const names = new Set(EXTRA_ICONS);

  for await (const file of walk(sourceDir)) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(ICON_USAGE)) {
      names.add(match[1] ?? match[2] ?? match[3]);
    }
  }

  return [...names].sort();
}

async function main() {
  const names = await collectIconNames();

  if (!existsSync(FULL_FONT)) {
    console.error(
      `Missing ${FULL_FONT}.\n` +
        'The full Material Symbols variable font is the subsetting *source* and\n' +
        'is not committed (10 MB). Download it — from the same repository\n' +
        'revision as scripts/material-symbols.codepoints, so glyph names and\n' +
        'codepoints agree:\n\n' +
        // N9: pinned to the commit that last touched the *.codepoints file
        // upstream (verified byte-identical to scripts/material-symbols.codepoints
        // at review time) — not `master`, which drifts as Google adds icons and
        // would silently desync the codepoint numbers from the committed file.
        // Bump both together: re-check the upstream .codepoints file's latest
        // commit, diff it against ours, and only then update this SHA.
        '  curl -sL "https://raw.githubusercontent.com/google/material-design-icons/50f0603134ce7b70b2d71b686cc13e8b57ccb74c/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.ttf" \\\n' +
        `    -o ${FULL_FONT}\n`
    );
    process.exitCode = 1;
    return;
  }

  const codepoints = await loadCodepoints();
  const unknown = names.filter((name) => !codepoints.has(name));

  if (unknown.length > 0) {
    console.error(
      `Not a Material Symbols icon: ${unknown.join(', ')}.\n` +
        'Check the spelling against https://fonts.google.com/icons — a name the\n' +
        'font does not carry renders as blank, which no test would otherwise catch.'
    );
    process.exitCode = 1;
    return;
  }

  const full = await readFile(FULL_FONT);

  // Codepoints only. No letters, because nothing renders a ligature any more.
  const text = names.map((name) => String.fromCodePoint(codepoints.get(name))).join('');

  const subset = await subsetFont(full, text, {
    targetFormat: 'woff2',
    preserveNameIds: [],
    // Nothing needs GSUB to survive — see the header comment.
    noLayoutClosure: true,
  });

  await writeFile(SUBSET_FONT, subset);
  await writeFile(MANIFEST, `${JSON.stringify({ icons: names, bytes: subset.length }, null, 2)}\n`);
  await writeFile(CODEPOINT_MODULE, codepointModule(names, codepoints));

  const sizeKb = (subset.length / 1024).toFixed(1);
  const fullKb = (full.length / 1024).toFixed(1);
  console.log(
    `Subset ${names.length} icons: ${fullKb} KB → ${sizeKb} KB ` +
      `(budget ${(BUDGET_BYTES / 1024).toFixed(0)} KB)`
  );

  if (subset.length > BUDGET_BYTES) {
    console.error(`Subset exceeds the ${BUDGET_BYTES} byte budget.`);
    process.exitCode = 1;
  }
}

/**
 * The generated name → codepoint map `components/ui/icon.tsx` renders from.
 *
 * Committed rather than built at runtime: it is twenty entries, it must agree
 * exactly with the glyphs in the subset font, and `pnpm icons:check` fails the
 * build when the two drift apart.
 */
function codepointModule(names, codepoints) {
  const entries = names
    .map((name) => `  ${name}: '\\u${codepoints.get(name).toString(16)}',`)
    .join('\n');

  return `/**
 * GENERATED by scripts/subset-icons.mjs — do not edit.
 *
 * Material Symbols renders here by codepoint, not by ligature; see that script
 * for why. Every entry has a matching glyph in
 * src/styles/fonts/material-symbols-outlined.woff2, which \`pnpm icons:check\`
 * verifies against actual \`<Icon name="…">\` usage on every build.
 */

export const ICON_CODEPOINTS = {
${entries}
} as const;

export type IconName = keyof typeof ICON_CODEPOINTS;
`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

export { FULL_FONT, MANIFEST, SUBSET_FONT, stat };
