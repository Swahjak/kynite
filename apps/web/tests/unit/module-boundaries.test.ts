import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => readFileSync(resolve(root, 'tests/fixtures', name), 'utf8');

const eslint = new ESLint({ cwd: root });

async function boundaryMessages(fixtureName: string, probe = 'probe.ts') {
  return messagesAt(fixtureName, `src/modules/__boundary_probe__/${probe}`);
}

/**
 * Lint a fixture *as if* it lived at `relativePath`. The path is what selects
 * the config block, so a rule scoped to a route group or to one directory can
 * only be exercised by pretending to be a file inside it.
 */
async function messagesAt(fixtureName: string, relativePath: string) {
  const [result] = await eslint.lintText(fixture(fixtureName), {
    // A path inside src/ so the project config applies (tests/fixtures is ignored).
    filePath: resolve(root, relativePath),
    warnIgnored: false,
  });

  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports');
}

describe('module boundary lint rule', () => {
  it('fires on deep `@/modules/<slice>/<file>` imports', { timeout: 60_000 }, async () => {
    const messages = await boundaryMessages('deep-import.fixture.ts');

    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.severity).toBe(2);
      expect(message.message).toMatch(/Deep module imports are banned/);
    }
  });

  it(
    'fires on relative deep `../modules/<slice>/<file>` imports',
    { timeout: 60_000 },
    async () => {
      const messages = await boundaryMessages('relative-deep-import.fixture.ts');

      expect(messages).toHaveLength(2);
      for (const message of messages) {
        expect(message.severity).toBe(2);
        expect(message.message).toMatch(/Deep module imports are banned/);
      }
    }
  );

  it('allows imports through the slice public index', { timeout: 60_000 }, async () => {
    const messages = await boundaryMessages('index-import.fixture.ts');

    expect(messages).toEqual([]);
  });

  it(
    'lets a slice schema import another slice schema — and nothing else',
    { timeout: 60_000 },
    async () => {
      const messages = await boundaryMessages('schema-cross-import.fixture.ts', 'schema.ts');

      // Only the two non-schema deep imports are reported; the foreign-key
      // imports of `@/modules/*/schema` are the sanctioned exception.
      expect(messages).toHaveLength(2);
      for (const message of messages) {
        expect(message.message).toMatch(/A slice schema may deep-import another slice `schema`/);
      }
    }
  );

  it(
    'lets a slice domain module import another slice domain — and nothing else',
    { timeout: 60_000 },
    async () => {
      const messages = await boundaryMessages(
        'domain-cross-import.fixture.ts',
        'domain/occurrence.ts'
      );

      // Only the two non-domain deep imports are reported; the pure
      // `domain/rrule` + `domain/zone` imports are the sanctioned exception.
      expect(messages).toHaveLength(2);
      for (const message of messages) {
        expect(message.message).toMatch(/A slice `domain` module may deep-import/);
      }
    }
  );

  it(
    'still bans a cross-slice domain import from a non-domain file',
    { timeout: 60_000 },
    async () => {
      const messages = await boundaryMessages('domain-cross-import.fixture.ts');

      expect(messages).toHaveLength(4);
    }
  );

  it(
    'still bans a cross-slice schema import from a non-schema file',
    { timeout: 60_000 },
    async () => {
      const messages = await boundaryMessages('schema-cross-import.fixture.ts');

      expect(messages).toHaveLength(4);
    }
  );
});

/**
 * M13's two rules (docs/architecture.md §2: the `(share)` group "must be
 * impossible to reach a mutation from"). They are the fast local signal;
 * `tests/unit/share-tree-no-server-actions.test.ts` is the guarantee, because
 * only that one follows the graph. Both are asserted, because a rule that only
 * fires in a repo scan is a rule people learn about too late.
 */
describe('(share) route tree lint rule', () => {
  const sharePage = 'src/app/[locale]/(share)/s/[token]/page.tsx';

  it('allows `@/modules/sharing/view` and bans everything else', { timeout: 60_000 }, async () => {
    const messages = await messagesAt('share-tree-import.fixture.ts', sharePage);

    // Three of the four imports are refused; `@/modules/sharing/view` is the
    // one that is not.
    expect(messages).toHaveLength(3);
    // The *subject* of each message — the quoted specifier it opens with — is
    // never the view entry point. (The message body names it, as the fix.)
    const subjects = messages.map((m) => m.message.match(/^'([^']+)'/)?.[1]);
    expect(subjects).not.toContain('@/modules/sharing/view');
    expect(subjects).toEqual([
      '@/modules/sharing/actions',
      '@/modules/calendar',
      '@/modules/calendar/queries',
    ]);
    expect(messages.map((m) => m.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/may import `@\/modules\/sharing\/view` only/),
        expect.stringMatching(/may not import a slice barrel/),
      ])
    );
  });

  it('does not apply outside the (share) tree', { timeout: 60_000 }, async () => {
    // The same fixture in an ordinary route file: only the *general* deep-import
    // ban fires, and the barrel import is fine. Proof the rule is scoped rather
    // than accidentally repo-wide.
    const messages = await messagesAt(
      'share-tree-import.fixture.ts',
      'src/app/[locale]/(app)/calendar/page.tsx'
    );

    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.message).toMatch(/Deep module imports are banned/);
    }
  });
});

describe('share view read path lint rule', () => {
  const viewFile = 'src/modules/sharing/view/load.ts';

  it(
    'allows `queries`, `domain`, `authorize` and `schema` — and nothing else',
    { timeout: 60_000 },
    async () => {
      const messages = await messagesAt('share-view-import.fixture.ts', viewFile);

      // The four action-free deep imports pass; the barrel, the action module
      // and the client component do not.
      expect(messages).toHaveLength(3);
      expect(messages.map((m) => m.message)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/may not import a slice barrel/),
          expect.stringMatching(/may deep-import another slice `queries`/),
        ])
      );
    }
  );

  it('covers the resolver too, not just `view/`', { timeout: 60_000 }, async () => {
    // `modules/sharing/resolve.ts` is in the (share) tree's transitive graph
    // just as much as `view/` is, so it carries the same rule.
    const messages = await messagesAt(
      'share-view-import.fixture.ts',
      'src/modules/sharing/resolve.ts'
    );
    expect(messages).toHaveLength(3);
  });
});
