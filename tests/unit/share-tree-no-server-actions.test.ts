import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * The `(share)` route tree imports **zero** Server Actions (M13,
 * docs/architecture.md §2: "`(share)` separate from both — no session at all;
 * must be impossible to reach a mutation from this tree").
 *
 * **Transitive, not one hop.** The interesting failure is never
 * `import { createEventAction }` in a page file — nobody writes that by
 * accident. It is a route file importing `@/modules/calendar` for a query and
 * getting the whole slice's mutation surface in the module graph behind it,
 * because a barrel re-exports actions and queries side by side. So this walks
 * the graph: every file under the tree, every module it imports, every module
 * *those* import, until the closure is exhausted — and fails on any module in
 * that closure whose first statement is a `'use server'` directive.
 *
 * **File-level, deliberately, unlike `no-negative-marking.test.ts`.** That
 * suite follows *named bindings*, because importing one component from a barrel
 * genuinely does not render every other component the barrel re-exports. This
 * one cannot afford the same nuance and should not want it: a `'use server'`
 * module in the graph is a module Next.js registers action endpoints for, and
 * whether this particular import names one of them is not the property being
 * defended. "Not in the graph at all" is the criterion.
 *
 * This is the guarantee; the lint rule in `eslint.config.mjs` is the fast local
 * signal that keeps a developer from finding out about it here.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The route trees that must be mutation-free. */
const SHARE_TREES = ['src/app/[locale]/(share)'];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(path, out);
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/** A module-level `'use server'` directive — the thing that makes a file a Server Action module. */
export function isServerActionModule(text: string): boolean {
  return /^\s*(['"])use server\1\s*;/.test(text);
}

/**
 * Resolve a relative or `@/`-aliased specifier to a real file. External
 * packages return `null`: `node_modules` is not part of the graph this defends,
 * and no dependency ships a Next.js `'use server'` module into it.
 */
function resolveModuleFile(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else if (specifier.startsWith('@/')) base = resolve(root, 'src', specifier.slice(2));
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Every module specifier `file` imports or re-exports, via the TypeScript AST.
 *
 * The AST rather than a regex because the shapes that matter here are exactly
 * the ones a regex loses: `export * from`, a multi-line clause, a
 * `import type` (which erases at build time but still tells you what the author
 * reached for), and `await import()`. A missed edge is a silent hole in a scan
 * whose entire value is completeness.
 */
export function importedSpecifiers(filePath: string, text: string): string[] {
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true);
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    // `import('…')` — a dynamic edge is still an edge.
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push((node.arguments[0] as ts.StringLiteral).text);
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return specifiers;
}

export type Reach = {
  /** The `'use server'` module that was reached, repo-relative. */
  action: string;
  /** How it was reached, entry file first — the path a fix has to break. */
  path: string[];
};

/**
 * Breadth-first over the import graph from `entryFiles`, returning every
 * `'use server'` module reachable from any of them, with the shortest path to
 * each. The path is the point: "you reached an action" is not actionable
 * feedback; "page.tsx → @/modules/calendar → actions.ts" is.
 */
export function serverActionsReachableFrom(entryFiles: string[]): Reach[] {
  const found: Reach[] = [];
  const seen = new Set<string>();
  const queue: { file: string; path: string[] }[] = entryFiles.map((file) => ({
    file,
    path: [relative(root, file)],
  }));

  while (queue.length > 0) {
    const { file, path } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const text = readFileSync(file, 'utf8');

    if (isServerActionModule(text) && path.length > 1) {
      found.push({ action: relative(root, file), path });
      // Not `continue`: a Server Action module's own imports are irrelevant
      // once it is already a violation, and reporting the shortest path to
      // each distinct action is more useful than the full downstream fan-out.
      continue;
    }

    for (const specifier of importedSpecifiers(file, text)) {
      const target = resolveModuleFile(file, specifier);
      if (target && !seen.has(target)) {
        queue.push({ file: target, path: [...path, relative(root, target)] });
      }
    }
  }

  return found;
}

describe('the (share) route tree reaches no Server Action', () => {
  const entryFiles = SHARE_TREES.flatMap((tree) => collectSourceFiles(join(root, tree)));

  it('finds the share tree at all — the scan is not vacuously green', () => {
    // A scan over an empty file list passes trivially. This is the guard
    // against the route group being renamed (or this list going stale) and the
    // suite quietly proving nothing, which is the same failure mode
    // `SHARE_TREES` exists to make loud.
    expect(entryFiles.length).toBeGreaterThan(0);
    expect(entryFiles.map((file) => relative(root, file))).toContain(
      'src/app/[locale]/(share)/s/[token]/page.tsx'
    );
  });

  it('reaches zero Server Actions, transitively', () => {
    const reached = serverActionsReachableFrom(entryFiles);

    expect(
      reached.map((entry) => entry.path.join(' → ')),
      'A (share) route file can reach a Server Action. Route the read through ' +
        '`@/modules/sharing/view` (the action-free entry point) instead of a slice barrel.'
    ).toEqual([]);
  });

  it('the whole closure is action-free, and the closure is real', () => {
    // Belt and braces on the previous test: assert the graph actually has
    // depth. A resolver bug that silently resolved nothing would make the
    // violation list empty for the wrong reason.
    const seen = new Set<string>();
    const queue = [...entryFiles];
    while (queue.length > 0) {
      const file = queue.shift()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const specifier of importedSpecifiers(file, readFileSync(file, 'utf8'))) {
        const target = resolveModuleFile(file, specifier);
        if (target) queue.push(target);
      }
    }

    expect(seen.size).toBeGreaterThan(entryFiles.length);
    // The view entry point is in the closure; the slice barrel that re-exports
    // the actions is not.
    const relatives = [...seen].map((file) => relative(root, file));
    expect(relatives).toContain('src/modules/sharing/view/index.ts');
    expect(relatives).not.toContain('src/modules/sharing/index.ts');
    expect(relatives).not.toContain('src/modules/sharing/actions.ts');
  });

  it('catches an action reached through two hops (fixture) — the scan is not vacuous', () => {
    const entry = join(root, 'tests/fixtures/share-tree/entry.fixture.ts');
    const reached = serverActionsReachableFrom([entry]);

    expect(reached).toHaveLength(1);
    expect(reached[0].action).toBe('tests/fixtures/share-tree/action.fixture.ts');
    expect(reached[0].path).toEqual([
      'tests/fixtures/share-tree/entry.fixture.ts',
      'tests/fixtures/share-tree/helper.fixture.ts',
      'tests/fixtures/share-tree/action.fixture.ts',
    ]);
  });

  it('does not fire on a genuinely clean tree (fixture)', () => {
    const entry = join(root, 'tests/fixtures/share-tree/clean-entry.fixture.ts');
    expect(serverActionsReachableFrom([entry])).toEqual([]);
  });
});
