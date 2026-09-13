import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const oxlintBin = resolve(root, 'node_modules/.bin/oxlint');
const fixture = (name: string) => readFileSync(resolve(root, 'tests/fixtures', name), 'utf8');

interface Diagnostic {
  message: string;
  code: string;
  severity: 'error' | 'warning';
  help: string;
}

function runOxlint(relativePath: string): Diagnostic[] {
  let stdout: string;
  try {
    stdout = execFileSync(oxlintBin, ['-f', 'json', relativePath], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (error) {
    // oxlint exits non-zero when it finds errors; the JSON is still on stdout.
    stdout = (error as { stdout?: string }).stdout ?? '';
  }
  return (JSON.parse(stdout) as { diagnostics: Diagnostic[] }).diagnostics;
}

const probePaths = new Set<string>();

/**
 * Lint a fixture *as if* it lived at `relativePath`. The path is what selects
 * the `.oxlintrc.json` override, so a rule scoped to a route group or to one
 * directory can only be exercised by actually placing a file inside it.
 *
 * Unlike ESLint's `lintText({ filePath })`, oxlint has no virtual-path API —
 * it reads real files — so the fixture is written to disk, linted, and
 * removed again (`afterEach` below is the safety net for early failures).
 */
function boundaryMessages(fixtureName: string, relativePath: string) {
  const absolute = resolve(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, fixture(fixtureName));
  probePaths.add(absolute);
  return runOxlint(relativePath).filter((d) => d.code === 'eslint(no-restricted-imports)');
}

afterEach(() => {
  for (const path of probePaths) {
    rmSync(path, { force: true });
  }
  probePaths.clear();
  // Clean up the scratch directories the probes above created.
  rmSync(resolve(root, 'src/modules/__boundary_probe__'), { recursive: true, force: true });
  rmSync(resolve(root, 'src/app/[locale]/(share)/__boundary_probe__'), {
    recursive: true,
    force: true,
  });
  rmSync(resolve(root, 'src/app/[locale]/(app)/__boundary_probe__'), {
    recursive: true,
    force: true,
  });
});

describe('module boundary lint rule', () => {
  it('fires on deep `@/modules/<slice>/<file>` imports', () => {
    const messages = boundaryMessages(
      'deep-import.fixture.ts',
      'src/modules/__boundary_probe__/probe.ts'
    );

    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.severity).toBe('error');
      expect(message.help).toMatch(/Deep module imports are banned/);
    }
  });

  it('fires on relative deep `../modules/<slice>/<file>` imports', () => {
    const messages = boundaryMessages(
      'relative-deep-import.fixture.ts',
      'src/modules/__boundary_probe__/probe.ts'
    );

    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.severity).toBe('error');
      expect(message.help).toMatch(/Deep module imports are banned/);
    }
  });

  it('allows imports through the slice public index', () => {
    const messages = boundaryMessages(
      'index-import.fixture.ts',
      'src/modules/__boundary_probe__/probe.ts'
    );

    expect(messages).toEqual([]);
  });

  it('lets a slice schema import another slice schema — and nothing else', () => {
    const messages = boundaryMessages(
      'schema-cross-import.fixture.ts',
      'src/modules/__boundary_probe__/schema.ts'
    );

    // Only the two non-schema deep imports are reported; the foreign-key
    // imports of `@/modules/*/schema` are the sanctioned exception.
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.help).toMatch(/A slice schema may deep-import another slice `schema`/);
    }
  });

  it('lets a slice domain module import another slice domain — and nothing else', () => {
    const messages = boundaryMessages(
      'domain-cross-import.fixture.ts',
      'src/modules/__boundary_probe__/domain/occurrence.ts'
    );

    // Only the two non-domain deep imports are reported; the pure
    // `domain/rrule` + `domain/zone` imports are the sanctioned exception.
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.help).toMatch(/A slice `domain` module may deep-import/);
    }
  });

  it('still bans a cross-slice domain import from a non-domain file', () => {
    const messages = boundaryMessages(
      'domain-cross-import.fixture.ts',
      'src/modules/__boundary_probe__/probe.ts'
    );

    expect(messages).toHaveLength(4);
  });

  it('still bans a cross-slice schema import from a non-schema file', () => {
    const messages = boundaryMessages(
      'schema-cross-import.fixture.ts',
      'src/modules/__boundary_probe__/probe.ts'
    );

    expect(messages).toHaveLength(4);
  });
});

/**
 * M13's two rules (docs/architecture.md §2: the `(share)` group "must be
 * impossible to reach a mutation from"). They are the fast local signal;
 * `tests/unit/share-tree-no-server-actions.test.ts` is the guarantee, because
 * only that one follows the graph. Both are asserted, because a rule that only
 * fires in a repo scan is a rule people learn about too late.
 */
describe('(share) route tree lint rule', () => {
  it('allows `@/modules/sharing/view` and bans everything else', () => {
    const messages = boundaryMessages(
      'share-tree-import.fixture.ts',
      'src/app/[locale]/(share)/__boundary_probe__/probe.tsx'
    );

    // Three of the four imports are refused; `@/modules/sharing/view` is the
    // one that is not.
    expect(messages).toHaveLength(3);
    // The *subject* of each message — the quoted specifier it opens with — is
    // never the view entry point. (The `help` field names it, as the fix.)
    const subjects = messages.map((m) => m.message.match(/^'([^']+)'/)?.[1]);
    expect(subjects).not.toContain('@/modules/sharing/view');
    expect(subjects).toEqual([
      '@/modules/sharing/actions',
      '@/modules/calendar',
      '@/modules/calendar/queries',
    ]);
    expect(messages.map((m) => m.help)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/may import `@\/modules\/sharing\/view` only/),
        expect.stringMatching(/may not import a slice barrel/),
      ])
    );
  });

  it('does not apply outside the (share) tree', () => {
    // The same fixture in an ordinary route file: only the *general* deep-import
    // ban fires, and the barrel import is fine. Proof the rule is scoped rather
    // than accidentally repo-wide.
    const messages = boundaryMessages(
      'share-tree-import.fixture.ts',
      'src/app/[locale]/(app)/__boundary_probe__/probe.tsx'
    );

    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.help).toMatch(/Deep module imports are banned/);
    }
  });
});

describe('share view read path lint rule', () => {
  it('allows `queries`, `domain`, `authorize` and `schema` — and nothing else', () => {
    const messages = boundaryMessages(
      'share-view-import.fixture.ts',
      'src/modules/sharing/view/__boundary_probe__.ts'
    );

    // The four action-free deep imports pass; the barrel, the action module
    // and the client component do not.
    expect(messages).toHaveLength(3);
    expect(messages.map((m) => m.help)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/may not import a slice barrel/),
        expect.stringMatching(/may deep-import another slice `queries`/),
      ])
    );
  });

  it('covers the resolver too, not just `view/`', () => {
    // `modules/sharing/resolve.ts` is in the (share) tree's transitive graph
    // just as much as `view/` is, and the override selects it by its exact
    // filename rather than a directory glob — so this test swaps the real
    // file's content for the fixture's, lints it, then restores the original.
    const resolvePath = resolve(root, 'src/modules/sharing/resolve.ts');
    const original = readFileSync(resolvePath, 'utf8');
    writeFileSync(resolvePath, fixture('share-view-import.fixture.ts'));
    try {
      const messages = runOxlint('src/modules/sharing/resolve.ts').filter(
        (d) => d.code === 'eslint(no-restricted-imports)'
      );
      expect(messages).toHaveLength(3);
    } finally {
      writeFileSync(resolvePath, original);
    }
  });
});
