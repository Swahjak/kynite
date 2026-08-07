import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Repo-wide enforcement of research §Decisions 1 and 3 and PRD FR11/FR13:
 * **no child-facing surface marks anything.**
 *
 * The rule is not "be careful in review" — it is a scan, because the failure
 * mode is a single innocuous-looking class or icon added months from now. Five
 * things are banned outright on every surface a child sees:
 *
 *   1. **Failure iconography** — a cross, an error glyph, a frowning face.
 *   2. **Alarm styling** — destructive/error/red tokens. Missed renders dimmed
 *      (one opacity), and dimming is the *only* treatment.
 *   3. **Negative deltas** — "-1 star". The ledger is append-only; a minus sign
 *      in front of a star is a lie about what the system can do.
 *   4. **Streak-loss vocabulary** — "streak lost", "broken", "missed", and the
 *      Dutch equivalents. Grace is bounded and silent; nothing announces it.
 *   5. **Cross-sibling comparison** — leaderboards, rankings, "vs".
 *
 * Parent-facing builder surfaces are a different audience with different needs
 * (a parent may delete a routine, and that button is legitimately destructive),
 * so they are exempt — from an explicitly pinned list, which the suite asserts
 * is exactly the set of parent-only files. A new child-facing component cannot
 * be added to it quietly.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Trees whose components a child sees on the hub. */
const CHILD_FACING_ROOTS = [
  'src/modules/routines/ui',
  'src/modules/rewards/ui',
  'src/modules/timers/ui',
  'src/components/celebration',
  'src/components/hub',
  'src/app/[locale]/(hub)',
  // M13. The caregiver share view renders routine steps and their done state to
  // an adult who is standing next to the child — which is the *worst* place for
  // a red cross or a "3 missed" line to appear, because it hands a visitor a
  // verdict on somebody else's kid. Same rules, same scanner.
  'src/modules/sharing/view',
  'src/app/[locale]/(share)',
];

/**
 * Parent-only files inside those trees. Every entry is a surface that never
 * renders on the hub; the test below proves the list contains nothing else.
 */
const PARENT_ONLY = [
  'src/modules/routines/ui/delete-routine-button.tsx',
  'src/modules/routines/ui/graduate-routine-button.tsx',
  'src/modules/routines/ui/routine-dialog.tsx',
  'src/modules/routines/ui/routine-list.tsx',
  // M16: the settings hub's graduation list. Parent-only by construction — it
  // is mounted from `(app)/settings`, which a device principal cannot reach at
  // all (`(app)/layout.tsx` sends a paired browser to the board).
  'src/modules/routines/ui/routine-graduation-list.tsx',
  'src/modules/rewards/ui/approval-queue.tsx',
  'src/modules/rewards/ui/award-stars-dialog.tsx',
  'src/modules/rewards/ui/delete-reward-button.tsx',
  'src/modules/rewards/ui/reward-dialog.tsx',
  'src/modules/rewards/ui/reward-list.tsx',
  'src/modules/rewards/ui/seed-presets-button.tsx',
  'src/modules/timers/ui/timer-controls.tsx',
];

type Rule = { id: string; pattern: RegExp };

const RULES: Rule[] = [
  {
    id: 'failure-iconography',
    // Icon names are a closed set (`components/ui/icon-codepoints.ts`), so the
    // check is on the `name=` attribute rather than on free text.
    pattern:
      /name=(['"])(close|cancel|error|warning|block|remove|do_not_disturb\w*|thumb_down|sentiment_\w*dissatisfied)\1/,
  },
  {
    id: 'alarm-styling',
    // Both the Tailwind utility form (`text-destructive`) and the shadcn/Base
    // UI variant prop form (`variant="destructive"`) read as an alert — a
    // component can carry the same alarm styling either way.
    pattern:
      /\b(?:text|bg|border|ring|fill|from|to|via)-(?:destructive|error|red-\d+|cat-red-\w+)\b|variant\s*=\s*["']destructive["']/,
  },
  {
    id: 'negative-delta',
    // "-1 star", "− 2 sterren", "-{count} point". A minus in front of a reward.
    pattern: /[-−]\s*(?:\d+|\{[^}]*\})\s*(?:stars?|sterren?|points?|punten?)\b/i,
  },
  {
    id: 'streak-loss',
    pattern:
      /\b(?:streak[\s_-]?(?:lost|broken|reset)|broken[\s_-]?chain|streakLost|verloren|kwijtgeraakt|niet gehaald|mislukt|failed)\b/i,
  },
  {
    id: 'sibling-comparison',
    pattern: /\b(?:leaderboard|scoreboard|ranglijst|ranking|rangschikking|beats|versus)\b/i,
  },
];

export type Finding = { file: string; rule: string; line: number; text: string };

export function scanForNegativeMarking(
  files: readonly { path: string; text: string }[]
): Finding[] {
  return files.flatMap(({ path, text }) =>
    text.split('\n').flatMap((line, index) => {
      // Comment bodies necessarily *name* the things they forbid, so they are
      // stripped: `//`, an inline `/* */`, and a JSDoc continuation line.
      const code = /^\s*\*/.test(line)
        ? ''
        : line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      return RULES.flatMap((rule) =>
        rule.pattern.test(code)
          ? [{ file: path, rule: rule.id, line: index + 1, text: line.trim() }]
          : []
      );
    })
  );
}

function collect(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

function childFacingFiles(): { path: string; text: string }[] {
  return CHILD_FACING_ROOTS.flatMap((tree) => collect(join(root, tree)))
    .map((path) => relative(root, path))
    .filter((path) => !PARENT_ONLY.includes(path))
    .map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));
}

/**
 * Generic BFS over an arbitrary import graph, independent of the filesystem
 * so it can be unit-tested against a fixture graph rather than only against
 * the real repo. `edges(file)` returns the files `file` imports; `target` is
 * reachable if following imports from any of `entryFiles` ever lands on it.
 */
export function isReachable(
  edges: (file: string) => readonly string[],
  entryFiles: readonly string[],
  target: string
): boolean {
  const visited = new Set<string>();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (file === target) return true;
    if (visited.has(file)) continue;
    visited.add(file);
    queue.push(...edges(file));
  }
  return false;
}

/** Resolve a relative or `@/`-aliased import specifier to a real file on disk. */
function resolveModuleFile(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else if (specifier.startsWith('@/')) {
    base = resolve(root, 'src', specifier.slice(2));
  } else {
    return null; // external package — not part of the internal import graph
  }
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

type BindingEdge = { local: string; imported: string; source: string };

/**
 * `{ A, B as C }` / `Def` / `Def, { A }` / `* as NS` / `*` — the clause
 * between `import`/`export` and `from`. Returns each binding this clause
 * introduces, as `{ local, imported }` (imported is the name on the *other*
 * side; `'default'` for a default import, `'*'` for a namespace/star).
 */
function parseClause(clause: string): { local: string; imported: string }[] {
  const trimmed = clause.trim();
  if (trimmed === '*') return [{ local: '*', imported: '*' }];

  const namespaceMatch = trimmed.match(/^\*\s+as\s+(\w+)$/);
  if (namespaceMatch) return [{ local: namespaceMatch[1], imported: '*' }];

  const results: { local: string; imported: string }[] = [];
  const braceMatch = trimmed.match(/\{([^}]*)\}/);
  const before = trimmed
    .replace(/\{[^}]*\}/, '')
    .replace(/,\s*$/, '')
    .trim();
  if (before) results.push({ local: before, imported: 'default' });

  if (braceMatch) {
    for (const part of braceMatch[1].split(',')) {
      const spec = part.trim();
      if (!spec) continue;
      const asMatch = spec.match(/^(\w+)\s+as\s+(\w+)$/);
      results.push(
        asMatch ? { local: asMatch[2], imported: asMatch[1] } : { local: spec, imported: spec }
      );
    }
  }
  return results;
}

/**
 * Every `import ... from 'spec'` / `export ... from 'spec'` in `file`,
 * resolved to real files — a re-export is exactly as good a path to a
 * component as a direct import, which is the whole point of walking this
 * transitively rather than grepping one file for one literal string.
 */
function collectEdges(file: string): BindingEdge[] {
  const text = readFileSync(file, 'utf8');
  const edges: BindingEdge[] = [];
  const statementRe = /(?:^|\n)\s*(?:import|export)\s+([^;\n]+?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(statementRe)) {
    const [, clause, specifier] = match;
    const source = resolveModuleFile(file, specifier);
    if (!source) continue;
    for (const binding of parseClause(clause)) edges.push({ ...binding, source });
  }
  return edges;
}

/**
 * Does the binding `name` in `file` (or, if `name` is `'*'`, *any* binding
 * `file` exposes) ultimately originate at `(targetFile, targetName)`,
 * following import/re-export chains? Named, not file-level: importing one
 * named export from a barrel does not pull in every other name the barrel
 * happens to also re-export.
 */
function resolvesToTarget(
  file: string,
  name: string,
  targetFile: string,
  targetName: string,
  visited: Set<string>
): boolean {
  const key = `${file} ${name}`;
  if (visited.has(key)) return false;
  visited.add(key);
  if (file === targetFile && (name === targetName || name === '*')) return true;

  for (const edge of collectEdges(file)) {
    if (edge.local !== name && edge.local !== '*') continue;
    if (resolvesToTarget(edge.source, edge.imported, targetFile, targetName, visited)) return true;
  }
  return false;
}

/** Does anything `entryFile` imports resolve, transitively, to `(targetFile, targetName)`? */
function reachesNamedExport(entryFile: string, targetFile: string, targetName: string): boolean {
  const visited = new Set<string>();
  return collectEdges(entryFile).some((edge) =>
    resolvesToTarget(edge.source, edge.imported, targetFile, targetName, visited)
  );
}

/** `delete-routine-button.tsx` -> `DeleteRoutineButton` (this repo's export-naming convention). */
function exportNameFor(path: string): string {
  return path
    .split('/')
    .pop()!
    .replace(/\.tsx?$/, '')
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

describe('no negative marking on any child-facing surface', () => {
  const files = childFacingFiles();

  it('scans a non-empty set of files (a scan of nothing always passes)', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files.map((file) => file.path)).toContain('src/modules/routines/ui/step-row.tsx');
    expect(files.map((file) => file.path)).toContain('src/modules/routines/ui/routine-card.tsx');
    expect(files.map((file) => file.path)).toContain('src/modules/routines/ui/routine-board.tsx');
    // M08's child-facing surfaces. The store is where a "you cannot afford
    // this" mark would be most tempting, so it must be in scope by name.
    expect(files.map((file) => file.path)).toContain('src/modules/rewards/ui/reward-card.tsx');
    expect(files.map((file) => file.path)).toContain('src/modules/rewards/ui/reward-store.tsx');
    expect(files.map((file) => file.path)).toContain('src/modules/rewards/ui/star-chart.tsx');
    // M09's child-facing surfaces. A timer that has run out is where an alarm
    // treatment would be most tempting, so both must be in scope by name.
    expect(files.map((file) => file.path)).toContain('src/modules/timers/ui/timer-tile.tsx');
    expect(files.map((file) => file.path)).toContain('src/modules/timers/ui/timer-board.tsx');
  });

  it('finds no red X, negative delta, streak loss or sibling comparison', () => {
    expect(scanForNegativeMarking(files)).toEqual([]);
  });

  it('catches every banned shape (fixture) — the scanner is not vacuous', () => {
    const path = 'tests/fixtures/negative-marking.fixture.tsx';
    const findings = scanForNegativeMarking([
      { path, text: readFileSync(join(root, path), 'utf8') },
    ]);

    expect([...new Set(findings.map((finding) => finding.rule))].sort()).toEqual([
      'alarm-styling',
      'failure-iconography',
      'negative-delta',
      'sibling-comparison',
      'streak-loss',
    ]);
  });

  it('pins the parent-only exemptions — every entry really is parent-only', () => {
    // Transitive and named-export-aware, not a literal-substring check on
    // `routine-board.tsx` alone: a parent-only file could be reached through
    // any hop — a helper module, or the slice's own `index.ts` barrel, which
    // re-exports both hub-safe and parent-only components side by side. A
    // file-level-only walk would treat "imports something from the barrel" as
    // reaching *everything* the barrel re-exports; this instead follows the
    // specific named binding each child-facing entry point actually imports.
    const entryFiles = files.map((file) => join(root, file.path));

    for (const path of PARENT_ONLY) {
      const absolute = join(root, path);
      expect(existsSync(absolute), `${path} is listed but does not exist`).toBe(true);
      const targetName = exportNameFor(path);
      const reached = entryFiles.some((entry) => reachesNamedExport(entry, absolute, targetName));
      expect(
        reached,
        `${path} is pinned parent-only but its export "${targetName}" is imported (directly or transitively) by child-facing code`
      ).toBe(false);
    }
  });

  it('transitive check catches a parent-only file reached indirectly (fixture) — the pin is not vacuous', () => {
    // A synthetic graph, not real files: board -> helper -> the "exempt" file.
    // If the check only looked at direct imports of `board`, this would pass
    // when it should fail.
    const graph: Record<string, string[]> = {
      'hub/board.tsx': ['hub/helper.tsx'],
      'hub/helper.tsx': ['builder/delete-button.tsx'],
      'builder/delete-button.tsx': [],
    };
    const edges = (file: string) => graph[file] ?? [];

    expect(isReachable(edges, ['hub/board.tsx'], 'builder/delete-button.tsx')).toBe(true);
    expect(isReachable(edges, ['hub/board.tsx'], 'builder/unrelated.tsx')).toBe(false);
  });
});

describe('the words a child reads', () => {
  const BANNED_COPY =
    /\b(?:streak lost|broken|missed|too late|failed|rejected|denied|weigeren|geweigerd|verloren|kwijt|gemist|te laat|mislukt|afgewezen|niet gedaan|slecht)\b/i;

  for (const locale of ['nl', 'en']) {
    it(`keeps the ${locale} routine copy free of loss and failure framing`, () => {
      const messages = JSON.parse(
        readFileSync(join(root, `messages/${locale}.json`), 'utf8')
      ) as Record<string, unknown>;

      const offenders: string[] = [];
      const walk = (node: unknown, path: string) => {
        if (typeof node === 'string') {
          if (BANNED_COPY.test(node)) offenders.push(`${path}: ${node}`);
          return;
        }
        if (node && typeof node === 'object') {
          for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
        }
      };

      walk(messages.routines, 'routines');
      // The reward copy is scanned alongside it: a denial is the single place
      // in this product where failure framing would be easiest to write, and
      // "not right now" has to stay "not right now" in both languages.
      walk(messages.rewards, 'rewards');
      // M09: the other one is a timer that ran out. It is never "missed",
      // "too late" or "failed" — the board simply says the time is up.
      walk(messages.timers, 'timers');
      expect(offenders).toEqual([]);
    });

    it(`keeps the ${locale} reward copy free of money framing`, () => {
      const messages = JSON.parse(
        readFileSync(join(root, `messages/${locale}.json`), 'utf8')
      ) as Record<string, unknown>;

      // FR16 / research §Decisions 8: no currency symbol and no money noun
      // reaches a family, in either language. The enum already makes a money
      // *category* impossible; this covers the words around it.
      const MONEY_COPY =
        /[€$£]|\b(?:euro|dollar|geld|zakgeld|money|allowance|cash|pocket money|betaal\w*|salaris)\b/i;

      const offenders: string[] = [];
      const walk = (node: unknown, path: string) => {
        if (typeof node === 'string') {
          if (MONEY_COPY.test(node)) offenders.push(`${path}: ${node}`);
          return;
        }
        if (node && typeof node === 'object') {
          for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
        }
      };

      walk(messages.rewards, 'rewards');
      expect(offenders).toEqual([]);
    });

    it(`gives the ${locale} praise lines the competence framing the research asks for`, () => {
      const messages = JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8')) as {
        routines: { praise: Record<string, string> };
      };

      const lines = Object.values(messages.routines.praise);
      expect(lines.length).toBeGreaterThanOrEqual(4);
      // Praise, not instruction: nothing in a praise line tells a child to do
      // something (that would be the parent-mouthpiece voice FR30 forbids).
      for (const line of lines) {
        expect(line).not.toMatch(/\b(?:please|graag|moet|must|now go|ga nu)\b/i);
      }
    });
  }
});
