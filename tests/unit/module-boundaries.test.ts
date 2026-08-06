import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => readFileSync(resolve(root, 'tests/fixtures', name), 'utf8');

const eslint = new ESLint({ cwd: root });

async function boundaryMessages(fixtureName: string) {
  const [result] = await eslint.lintText(fixture(fixtureName), {
    // A path inside src/ so the project config applies (tests/fixtures is ignored).
    filePath: resolve(root, 'src/modules/__boundary_probe__/probe.ts'),
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

  it('allows imports through the slice public index', { timeout: 60_000 }, async () => {
    const messages = await boundaryMessages('index-import.fixture.ts');

    expect(messages).toEqual([]);
  });
});
