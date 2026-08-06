import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Repo-wide enforcement of the M04 hard invariant and research §Decisions 1:
 * **no code path anywhere updates or deletes a `star_ledger` row.**
 *
 * The database already refuses to hold a non-positive amount
 * (`CHECK (amount > 0)`, proven against a real Postgres in
 * `tests/integration/star-ledger.test.ts`). That constraint stops a *negative*
 * star. It does not stop `db.delete(starLedger)`, or an `update` that rewrites
 * `reason`, `note` or `memberId` — both of which would silently rewrite a
 * child's history while every existing test stayed green.
 *
 * So this is a scan, not a review convention, and it is deliberately paranoid
 * in four directions at once:
 *
 *   1. **Drizzle builders** — `db.update(starLedger)`, `tx.delete(starLedger)`,
 *      and the same through any alias the ledger table is imported under.
 *   2. **Raw SQL in application code** — `sql\`update star_ledger …\``,
 *      `delete from star_ledger`, `truncate star_ledger`, in any casing and
 *      across a line break.
 *   3. **The alias problem** — a file that does `import { starLedger as ledger }`
 *      is resolved through its import clause, so renaming the binding does not
 *      hide the call.
 *   4. **Migrations** — the same three raw-SQL shapes, plus dropping the
 *      `star_ledger_amount_positive` check constraint, in `drizzle/*.sql`. A
 *      hand-edited or generated migration is exactly as capable of rewriting
 *      history as a Server Action is, and it runs outside `src/` entirely.
 *
 * `tests/fixtures/star-ledger-mutation.fixture.ts` proves the scanner is not
 * vacuous: every banned shape appears there exactly once and must be found.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The table's drizzle export name and its physical name. */
const LEDGER_EXPORT = 'starLedger';
const LEDGER_TABLE = 'star_ledger';

/** Builder methods that write to an existing row, or remove one. */
const MUTATING_METHODS = new Set(['update', 'delete']);

export type LedgerFinding = { file: string; line: number; kind: string; text: string };

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * Every local binding in this file that refers to the star ledger table.
 *
 * `import { starLedger }` gives `starLedger`; `import { starLedger as ledger }`
 * gives `ledger`; `import * as schema` gives the namespace, which is why the
 * member-expression form (`schema.starLedger`) is matched separately below.
 */
function ledgerBindings(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;

    for (const element of clause.namedBindings.elements) {
      // `propertyName` is set only for `{ a as b }`, where it holds `a`.
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === LEDGER_EXPORT) names.add(element.name.text);
    }
  }

  return names;
}

/** `starLedger` / `ledger` / `schema.starLedger` — the argument shapes we ban. */
function isLedgerArgument(node: ts.Expression, bindings: ReadonlySet<string>): boolean {
  if (ts.isIdentifier(node)) return bindings.has(node.text);
  if (ts.isPropertyAccessExpression(node)) return node.name.text === LEDGER_EXPORT;
  return false;
}

/** `<anything>.update(starLedger)` / `<anything>.delete(starLedger)`. */
function builderMutations(source: ts.SourceFile, bindings: ReadonlySet<string>): LedgerFinding[] {
  const findings: LedgerFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      MUTATING_METHODS.has(node.expression.name.text) &&
      node.arguments.length > 0 &&
      isLedgerArgument(node.arguments[0], bindings)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      findings.push({
        file: source.fileName,
        line: line + 1,
        kind: `drizzle-${node.expression.name.text}`,
        text: node.getText(source).split('\n')[0].trim(),
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return findings;
}

/**
 * Raw SQL against the physical table.
 *
 * `[\s\S]*?` rather than `.*?` so a statement broken across lines — which is
 * how any non-trivial `sql` template literal is actually written — is still
 * matched. Whitespace-insensitive and case-insensitive for the same reason.
 */
const RAW_SQL_PATTERNS: { kind: string; pattern: RegExp }[] = [
  { kind: 'raw-update', pattern: new RegExp(String.raw`\bupdate\s+"?${LEDGER_TABLE}"?\b`, 'i') },
  {
    kind: 'raw-delete',
    pattern: new RegExp(String.raw`\bdelete\s+from\s+"?${LEDGER_TABLE}"?\b`, 'i'),
  },
  {
    kind: 'raw-truncate',
    pattern: new RegExp(String.raw`\btruncate\s+("?table"?\s+)?"?${LEDGER_TABLE}"?\b`, 'i'),
  },
];

function rawSqlMutations(filePath: string, text: string): LedgerFinding[] {
  const lines = text.split('\n');

  return lines.flatMap((line, index) => {
    // Comments necessarily *name* the things they forbid (this file included),
    // so they are stripped before matching — the same treatment
    // `no-negative-marking` gives them.
    const code = /^\s*\*/.test(line) ? '' : line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (code.trim() === '') return [];

    // One line of lookahead: `sql\`update\n  star_ledger …\`` is one statement
    // split across two source lines, and prettier will do exactly that to any
    // template literal long enough to matter. Anchored on the *first* line, so
    // a hit is reported once rather than twice.
    const window = `${code} ${lines[index + 1] ?? ''}`;

    return RAW_SQL_PATTERNS.flatMap(({ kind, pattern }) =>
      pattern.test(window) ? [{ file: filePath, line: index + 1, kind, text: line.trim() }] : []
    );
  });
}

/** Dropping the check constraint that makes the table append-only in Postgres itself. */
const CONSTRAINT_DROP_PATTERN = new RegExp(
  String.raw`\bdrop\s+constraint\b[\s\S]*?star_ledger_amount_positive`,
  'i'
);

const MIGRATION_SQL_PATTERNS: { kind: string; pattern: RegExp }[] = [
  ...RAW_SQL_PATTERNS,
  { kind: 'raw-drop-constraint', pattern: CONSTRAINT_DROP_PATTERN },
];

/**
 * The same raw-SQL pass as `rawSqlMutations`, plus the constraint drop, run
 * over a generated migration rather than application code. Migrations have no
 * `//` comments to strip — drizzle-kit annotates each statement with a
 * trailing `--> statement-breakpoint` marker instead, which the `--.*$`
 * strip removes along with any genuine `--` comment, the same treatment the
 * application-code pass gives `//`.
 */
export function scanMigrationForLedgerMutations(filePath: string, text: string): LedgerFinding[] {
  const lines = text.split('\n');

  return lines.flatMap((line, index) => {
    const code = line.replace(/--.*$/, '');
    if (code.trim() === '') return [];

    // Same one-line lookahead as the application-code pass: drizzle-kit can
    // still wrap a long statement across lines.
    const window = `${code} ${lines[index + 1] ?? ''}`;

    return MIGRATION_SQL_PATTERNS.flatMap(({ kind, pattern }) =>
      pattern.test(window) ? [{ file: filePath, line: index + 1, kind, text: line.trim() }] : []
    );
  });
}

export function scanForLedgerMutations(
  files: readonly { path: string; text: string }[]
): LedgerFinding[] {
  return files.flatMap(({ path, text }) => {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true);
    const bindings = ledgerBindings(source);

    return [
      ...builderMutations(source, bindings).map((finding) => ({ ...finding, file: path })),
      ...rawSqlMutations(path, text),
    ];
  });
}

function sourceFiles(): { path: string; text: string }[] {
  return collectSourceFiles(join(root, 'src')).map((absolute) => ({
    path: relative(root, absolute),
    text: readFileSync(absolute, 'utf8'),
  }));
}

/** `drizzle/*.sql` only — not `drizzle/meta/`, which holds JSON snapshots, not SQL. */
function migrationFiles(): { path: string; text: string }[] {
  const dir = join(root, 'drizzle');
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => join(dir, entry.name))
    .map((absolute) => ({
      path: relative(root, absolute),
      text: readFileSync(absolute, 'utf8'),
    }));
}

describe('the star ledger is append-only in code, not just in the database', () => {
  const files = sourceFiles();

  it('scans a non-empty set of files (a scan of nothing always passes)', () => {
    expect(files.length).toBeGreaterThan(50);
    // The two modules that legitimately *insert* ledger rows must be in scope,
    // or the scan is looking somewhere the risk is not.
    const paths = files.map((file) => file.path);
    expect(paths).toContain('src/modules/routines/actions.ts');
    expect(paths).toContain('src/modules/rewards/actions.ts');
  });

  it('finds no update, delete or truncate of star_ledger anywhere in src/', () => {
    expect(scanForLedgerMutations(files)).toEqual([]);
  });

  it('catches every banned shape (fixture) — the scanner is not vacuous', () => {
    const path = 'tests/fixtures/star-ledger-mutation.fixture.ts';
    const findings = scanForLedgerMutations([
      { path, text: readFileSync(join(root, path), 'utf8') },
    ]);

    expect([...new Set(findings.map((finding) => finding.kind))].sort()).toEqual([
      'drizzle-delete',
      'drizzle-update',
      'raw-delete',
      'raw-truncate',
      'raw-update',
    ]);
  });

  it('resolves an aliased import — renaming the binding does not hide the call', () => {
    const findings = scanForLedgerMutations([
      {
        path: 'synthetic.ts',
        text: [
          "import { starLedger as ledger } from '@/server/db/schema';",
          'export const wipe = (db: never) => db.delete(ledger);',
        ].join('\n'),
      },
    ]);

    expect(findings.map((finding) => finding.kind)).toEqual(['drizzle-delete']);
  });

  it('resolves a namespace import — schema.starLedger is the same table', () => {
    const findings = scanForLedgerMutations([
      {
        path: 'synthetic.ts',
        text: [
          "import * as schema from '@/server/db/schema';",
          'export const rewrite = (db: never) => db.update(schema.starLedger);',
        ].join('\n'),
      },
    ]);

    expect(findings.map((finding) => finding.kind)).toEqual(['drizzle-update']);
  });

  it('leaves inserts and reads alone — append-only is not read-only', () => {
    const findings = scanForLedgerMutations([
      {
        path: 'synthetic.ts',
        text: [
          "import { starLedger } from '@/server/db/schema';",
          'export const award = (db: never) => db.insert(starLedger);',
          'export const read = (db: never) => db.select().from(starLedger);',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('does not fire on another table whose name merely contains the ledger name', () => {
    const findings = scanForLedgerMutations([
      {
        path: 'synthetic.ts',
        text: [
          "import { sql } from 'drizzle-orm';",
          'export const q = sql`delete from star_ledger_archive where id = 1`;',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([]);
  });
});

describe('the star ledger is append-only in generated migrations too', () => {
  const files = migrationFiles();

  it('scans a non-empty set of migrations (a scan of nothing always passes)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('finds no update, delete, truncate or dropped amount-positive constraint on star_ledger in any existing migration', () => {
    // Every migration in the repo today only ever CREATEs — this fails the
    // moment a future migration touches the ledger the way the scan forbids.
    const findings = files.flatMap(({ path, text }) => scanMigrationForLedgerMutations(path, text));
    expect(findings).toEqual([]);
  });

  /**
   * Mutation-verified against an in-memory fixture rather than a real
   * migration file: touching a committed migration (even temporarily) risks
   * a drizzle-kit snapshot/journal mismatch and is not something this suite
   * should ever do. The scan function itself takes a filename and a string,
   * so it is directly testable without touching disk.
   */
  it('catches every banned shape (in-memory fixture) — the scanner is not vacuous', () => {
    const fixture = [
      'ALTER TABLE "star_ledger" DROP CONSTRAINT "star_ledger_amount_positive";--> statement-breakpoint',
      "UPDATE star_ledger SET amount = 1 WHERE id = 'x';--> statement-breakpoint",
      "DELETE FROM star_ledger WHERE id = 'x';--> statement-breakpoint",
      'TRUNCATE TABLE star_ledger;--> statement-breakpoint',
    ].join('\n');

    const findings = scanMigrationForLedgerMutations('synthetic.sql', fixture);

    expect([...new Set(findings.map((finding) => finding.kind))].sort()).toEqual([
      'raw-delete',
      'raw-drop-constraint',
      'raw-truncate',
      'raw-update',
    ]);
  });

  it('leaves a CREATE-only migration alone (in-memory fixture)', () => {
    const fixture = [
      'CREATE TABLE "star_ledger" (',
      '  "id" uuid PRIMARY KEY NOT NULL,',
      '  "amount" integer NOT NULL,',
      '  CONSTRAINT "star_ledger_amount_positive" CHECK ("amount" > 0)',
      ');--> statement-breakpoint',
    ].join('\n');

    expect(scanMigrationForLedgerMutations('synthetic.sql', fixture)).toEqual([]);
  });
});
