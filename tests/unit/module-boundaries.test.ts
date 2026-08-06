import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => readFileSync(resolve(root, 'tests/fixtures', name), 'utf8');

const eslint = new ESLint({ cwd: root });

async function boundaryMessages(fixtureName: string, probe = 'probe.ts') {
  const [result] = await eslint.lintText(fixture(fixtureName), {
    // A path inside src/ so the project config applies (tests/fixtures is ignored).
    filePath: resolve(root, `src/modules/__boundary_probe__/${probe}`),
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
