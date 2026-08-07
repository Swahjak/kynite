import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * M15: "A repo-scan test fails on hardcoded user-facing strings in `src/app`
 * and `src/modules/*ui` (allowlist for dev-only routes)."
 *
 * The scan walks the TypeScript AST (the same approach as
 * `share-tree-no-server-actions.test.ts` and
 * `server-action-authorization.test.ts` — a regex over source text cannot
 * tell a JSX text node from a comment or a template literal used for a
 * `className`) of every `.ts`/`.tsx` file under `src/app`,
 * `src/modules/*{ui,view}` and `src/components` (minus test files and
 * `EXCLUDED_FILES`), and flags four shapes of literal a translator will never
 * see:
 *
 * - **JSX text nodes** — `<p>Something went wrong</p>`.
 * - **String literals inside a JSX expression container**, including
 *   ternary branches — `{cond ? 'Busy' : 'Free'}` — which a plain "is this
 *   node a `StringLiteral`" check misses because the top-level node is a
 *   `ConditionalExpression`, not a literal.
 * - **String-literal JSX attributes** on the props a screen reader or a
 *   tooltip actually reads: `title`, `aria-label`, `aria-description`,
 *   `alt`, `placeholder` (ternary-aware the same way). Not `className`, `id`,
 *   `href`, `data-*`, `name`, `htmlFor`, `type`, `key`, `role`, `src`,
 *   `data-testid` — those are values the DOM or a test selector reads, not a
 *   person.
 * - **`description` object-literal properties** in plain (non-JSX) `.ts`
 *   files — `src/app/manifest.ts` and `[locale]/layout.tsx`'s static
 *   `metadata` export are prose with no JSX in sight, which a `.tsx`-only,
 *   JSX-only scan structurally could not catch.
 *
 * `src/app/dev/**` is out of scope (dev-only routes never ship to a family),
 * test files never ship either, and `MANUAL_ALLOWLIST`/`EXCLUDED_FILES` below
 * are a pragmatic, individually-justified escape hatch for the handful of
 * strings and files that are not translatable copy at all (an emoji used as a
 * decorative glyph, a static manifest with no request to localize from, an
 * offline-transport protocol constant). Every other flagged literal is real
 * copy that has to move into `messages/{nl,en}.json`.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const SCAN_ROOTS = ['src/app', 'src/modules', 'src/components'];

/** Dev-only routes never reach a family — excluded by the acceptance criterion itself. */
const EXCLUDED_DIR_SEGMENTS = ['src/app/dev'];

/**
 * Files that are genuinely not UI copy, individually justified rather than
 * excluded by a broad glob — the same discipline `MANUAL_ALLOWLIST` applies to
 * individual strings. Each entry is a file, not a directory, so adding a new
 * file to one of these directories does not silently inherit the exemption.
 * `src/components/**` in particular carries several `.ts` (non-`.tsx`)
 * modules that are transport/protocol code, not UI — they hold no JSX, so the
 * JSX-shaped rules below never fire on them regardless, but they're named here
 * so the exemption is visible rather than implicit in "well, no JSX".
 */
const EXCLUDED_FILES = new Set([
  // Cache-name/IDB-store/sync-queue constants and service-worker message
  // protocol strings: read by this client's own worker and IndexedDB, never
  // rendered for a person.
  'src/components/offline/schedule-cache.ts',
  'src/components/offline/sw-strategy.ts',
  'src/components/offline/reload-gate.ts',
  'src/components/offline/clear-user-caches.ts',
  // Realtime SSE transport: event names and outbox keys, the wire protocol
  // between the client and `/api/events`, not copy.
  'src/components/realtime/echo.ts',
  'src/components/realtime/outbox.ts',
]);

/** JSX attributes whose string value is copy a person reads. */
const USER_FACING_ATTRS = new Set([
  'title',
  'aria-label',
  'aria-description',
  'alt',
  'placeholder',
]);

/**
 * Individually-justified exceptions: `relative/path.tsx` → literal text.
 * Each entry needs a one-line reason. Keep this list small — it is meant for
 * "this is not translatable copy," never for "I didn't get to this one."
 */
const MANUAL_ALLOWLIST: Record<string, string[]> = {
  // Decorative glyphs and single symbols already covered by the
  // punctuation/length filters below don't need entries here. Reserved for
  // future genuine exceptions (e.g. a brand wordmark rendered as a literal
  // outside `common.appName`).

  // Static `Metadata`/`MetadataRoute.Manifest` objects, not `generateMetadata`
  // — there is no request in scope to read a locale from (see the comments on
  // both). `nl` is `routing.defaultLocale`, which is why both now carry the
  // *same* Dutch string instead of the English one this scan originally
  // caught (NON-BLOCKING 4c) — genuinely not per-request-translatable copy,
  // not an oversight.
  'src/app/[locale]/layout.tsx': ['Gezinsplanning die daadwerkelijk gebeurt.'],
  'src/app/manifest.ts': ['Gezinsplanning die daadwerkelijk gebeurt.'],
};

export type Finding = {
  file: string;
  kind: 'jsx-text' | 'attribute';
  attr?: string;
  text: string;
  line: number;
};

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const relPath = relative(root, path);
    if (
      EXCLUDED_DIR_SEGMENTS.some(
        (excluded) => relPath === excluded || relPath.startsWith(`${excluded}/`)
      )
    ) {
      continue;
    }
    if (entry.isDirectory()) collectSourceFiles(path, out);
    // Test files carry fixture copy in whatever locale is convenient for the
    // assertion (`icon.test.tsx`'s Dutch fixtures, for instance) — they never
    // ship, so they are not a source of untranslated production strings.
    else if (/\.(test|spec)\.tsx?$/.test(path)) continue;
    // `.ts` is in scope too now (not just `.tsx`): `src/app/manifest.ts` and
    // `[locale]/layout.tsx`'s `metadata` export are plain object literals with
    // no JSX at all, so a `.tsx`-only scan structurally cannot see the
    // `description` strings that shipped hardcoded English into a Dutch-lang
    // manifest (BLOCKING/NON-BLOCKING 4c's finding). `.ts` files with no JSX
    // and no `description` property simply produce zero findings below — the
    // widened extension costs nothing where there is nothing to find.
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/**
 * `src/app/**`, `src/modules/<slice>/{ui,view}/**`, and `src/components/**`
 * (minus `EXCLUDED_FILES`) — real UI, not queries/actions/schema/domain. The
 * `(share)` tree's read-only render module lives under `view/`, not `ui/`
 * (see `modules/sharing/view/share-board.tsx`), which is why both are listed.
 */
function isInScope(filePath: string): boolean {
  const relPath = relative(root, filePath).replace(/\\/g, '/');
  if (EXCLUDED_FILES.has(relPath)) return false;
  if (relPath.startsWith('src/app/')) return true;
  if (relPath.startsWith('src/components/')) return true;
  const match = relPath.match(/^src\/modules\/[^/]+\/(ui|view)\//);
  return match !== null;
}

/** Whitespace, punctuation-only, or single-character strings are not copy. */
function isTrivial(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length === 1) return true;
  // Punctuation/symbols/digits only — "…", "-", "1/2", "{count}".
  if (!/\p{L}/u.test(trimmed)) return true;
  // A single non-space "word" of two-plus chars with no letNo — already
  // covered by the letter check above.
  return false;
}

function isAllowlisted(filePath: string, text: string): boolean {
  const relPath = relative(root, filePath).replace(/\\/g, '/');
  return (MANUAL_ALLOWLIST[relPath] ?? []).includes(text.trim());
}

function lineOf(source: ts.SourceFile, pos: number): number {
  return source.getLineAndCharacterOfPosition(pos).line + 1;
}

/**
 * Every string literal reachable through a chain of ternaries — `cond ? 'A' :
 * 'B'`, and `cond ? 'A' : cond2 ? 'B' : 'C'` by recursing into `whenFalse`.
 * This is what closes the scan hole a plain "is this node a StringLiteral"
 * check misses: `{isBusy ? 'Busy' : event.title}` is a `ConditionalExpression`
 * inside the `JsxExpression`, not a `StringLiteral` at the top, so the literal
 * text was invisible to the original rule despite reading exactly like the
 * `<p>Something went wrong</p>` case the scan already caught.
 */
function literalStringsFrom(expr: ts.Expression): ts.StringLiteral[] {
  if (ts.isStringLiteral(expr)) return [expr];
  if (ts.isConditionalExpression(expr)) {
    return [...literalStringsFrom(expr.whenTrue), ...literalStringsFrom(expr.whenFalse)];
  }
  return [];
}

/**
 * `.ts` object-literal properties named `description` — the shape
 * `manifest.ts` and `[locale]/layout.tsx`'s static `metadata` export use for
 * real user-facing copy that carries no JSX at all (5b). Scoped to this one
 * property name deliberately: `description` is reliably prose in this
 * codebase's metadata objects, where `name`/`id`/`scope` are brand names or
 * protocol values a broader rule would false-positive on constantly.
 */
const METADATA_STRING_PROPS = new Set(['description']);

export function scanFile(filePath: string, text: string): Finding[] {
  const source = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );
  const findings: Finding[] = [];

  const pushIfReal = (kind: Finding['kind'], raw: string, pos: number, attr?: string) => {
    if (isTrivial(raw)) return;
    if (isAllowlisted(filePath, raw)) return;
    findings.push({
      file: relative(root, filePath),
      kind,
      attr,
      text: raw.trim(),
      line: lineOf(source, pos),
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      pushIfReal('jsx-text', node.text, node.getStart(source));
    }

    // A JSX expression container that is *not* an attribute's initializer is
    // a child position — `<p>{cond ? 'A' : 'B'}</p>`. Attribute-initializer
    // containers are handled in the branch below instead, so this skips them
    // to avoid double-reporting the same literal twice.
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      !(node.parent && ts.isJsxAttribute(node.parent))
    ) {
      for (const literal of literalStringsFrom(node.expression)) {
        pushIfReal('jsx-text', literal.text, literal.getStart(source));
      }
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const attrName = node.name.text;
      if (USER_FACING_ATTRS.has(attrName) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          pushIfReal(
            'attribute',
            node.initializer.text,
            node.initializer.getStart(source),
            attrName
          );
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          for (const literal of literalStringsFrom(node.initializer.expression)) {
            pushIfReal('attribute', literal.text, literal.getStart(source), attrName);
          }
        }
      }
    }

    // Object-literal metadata (5b): `{ description: 'Prose the App Store
    // shows a family before install' }`, with no JSX in the file at all.
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      METADATA_STRING_PROPS.has(node.name.text) &&
      ts.isStringLiteral(node.initializer)
    ) {
      pushIfReal(
        'attribute',
        node.initializer.text,
        node.initializer.getStart(source),
        node.name.text
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return findings;
}

function scanTree(): Finding[] {
  const files = SCAN_ROOTS.flatMap((dir) => collectSourceFiles(resolve(root, dir))).filter(
    isInScope
  );
  return files.flatMap((file) => scanFile(file, readFileSync(file, 'utf8')));
}

describe('no hardcoded user-facing strings in src/app or src/modules/*/ui', () => {
  it('scans a non-empty, real set of files (a scan of nothing always passes)', () => {
    const files = SCAN_ROOTS.flatMap((dir) => collectSourceFiles(resolve(root, dir))).filter(
      isInScope
    );
    expect(files.length).toBeGreaterThan(20);
  });

  it('finds no hardcoded JSX text or user-facing attribute literal', () => {
    const findings = scanTree();
    expect(findings).toEqual([]);
  });

  it('excludes src/app/dev — a dev-only route may hardcode strings (fixture)', () => {
    const devFile = resolve(root, 'src/app/dev/design/design-showcase.tsx');
    expect(devFile.startsWith(resolve(root, 'src/app/dev'))).toBe(true);
    const files = SCAN_ROOTS.flatMap((dir) => collectSourceFiles(resolve(root, dir))).filter(
      isInScope
    );
    expect(files.some((file) => file.startsWith(resolve(root, 'src/app/dev')))).toBe(false);
  });

  it('catches the shapes it exists to prevent (fixture, non-vacuity)', () => {
    const fixture = `
      export function Example({ onClick }: { onClick: () => void }) {
        return (
          <div>
            <p>Something went wrong, please try again.</p>
            <button title="Close this dialog" aria-label="Dismiss" onClick={onClick}>
              {'X'}
            </button>
            <input placeholder="Enter your name" className="text-body" data-testid="name-input" />
            <span>{'1'}</span>
            <span>—</span>
          </div>
        );
      }
    `;

    const findings = scanFile(resolve(root, 'src/app/__fixture__.tsx'), fixture);
    const texts = findings.map((finding) => finding.text).sort();

    expect(texts).toContain('Something went wrong, please try again.');
    expect(texts).toContain('Close this dialog');
    expect(texts).toContain('Dismiss');
    expect(texts).toContain('Enter your name');
    // className and data-testid are not user-facing attrs; '1' and '—' are trivial.
    expect(findings.some((finding) => finding.attr === 'className')).toBe(false);
    expect(findings.some((finding) => finding.text === '1')).toBe(false);
    expect(findings.some((finding) => finding.text === '—')).toBe(false);
  });
});
