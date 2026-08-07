import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { REALTIME_EVENT_TYPES, type RealtimeEventType } from '@/modules/realtime/schema';

/**
 * M10's exhaustiveness criterion: **every `RealtimeEvent.type` in
 * docs/architecture.md §4 is published by its owning slice.**
 *
 * The failure this guards against is not "we forgot to add a type" — the union
 * is pinned by `REALTIME_EVENT_TYPES` and the compiler. It is the quieter one:
 * a type that *exists* in the vocabulary and that nothing ever emits, so a
 * client subscribes to an event that will never arrive and the surface silently
 * falls back to a page reload. That is invisible in review and invisible in
 * every other test.
 *
 * The scan is structural (TypeScript AST) rather than a grep, so a
 * `type: 'timer.started'` inside a *filter* array or a string in a comment is
 * not mistaken for a publication. It counts an object literal with a
 * `type: '<realtime type>'` property that is passed as a **call argument** —
 * which is what both shapes in this repo look like: `publish({ type: … })` on
 * the request path, and `emit({ type: … })` from the sync engines (whose
 * emissions funnel into `publishEmitter` → `publish()`).
 *
 * A third shape exists because the calendar slice funnels its four mutation
 * paths through one `publishEvent(principal, 'event.upserted', ids)` helper —
 * there the type is a bare string argument, not a property. So a realtime type
 * appearing as a *direct call argument* counts too. Client code is excluded
 * from the scan entirely (`ui/`): a component naming an event type is
 * subscribing to it, never publishing it.
 *
 * `tests/fixtures/realtime-publish.fixture.ts` proves the scanner is not
 * vacuous: it contains all three shapes and three decoys, and the assertion
 * below demands exactly the real ones.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const REALTIME_TYPES = new Set<string>(REALTIME_EVENT_TYPES);

/**
 * Which slice must publish each event. One owner per type, deliberately:
 * "somebody publishes it" is not the criterion — a type has a slice whose
 * writes are the reason it exists, and that slice is the one that must emit it.
 *
 * `stars.awarded` is owned by `rewards` (the slice that owns the ledger);
 * `routines` also publishes it when a completion pays, which is additive, not
 * a second owner.
 */
const OWNERS: Record<RealtimeEventType, string> = {
  'event.upserted': 'calendar',
  'event.deleted': 'calendar',
  'completion.created': 'routines',
  'completion.undone': 'routines',
  'stars.awarded': 'rewards',
  'redemption.requested': 'rewards',
  'redemption.decided': 'rewards',
  'routine.updated': 'routines',
  'timer.started': 'timers',
  'timer.stopped': 'timers',
  'device.revoked': 'devices',
  'sync.status': 'google',
};

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

export type Publication = { type: string; file: string };

/**
 * Every `{ type: '<realtime type>', … }` object literal that is handed to a
 * call, in one file.
 */
export function findPublications(filePath: string, text: string): Publication[] {
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true);
  const found: Publication[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      for (const argument of node.arguments) {
        // Shape 3: `publishEvent(principal, 'event.upserted', ids)`.
        if (ts.isStringLiteralLike(argument) && REALTIME_TYPES.has(argument.text)) {
          found.push({ type: argument.text, file: relative(root, filePath) });
          continue;
        }

        if (!ts.isObjectLiteralExpression(argument)) continue;

        for (const property of argument.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          if (!ts.isIdentifier(property.name) || property.name.text !== 'type') continue;
          if (!ts.isStringLiteralLike(property.initializer)) continue;
          if (!REALTIME_TYPES.has(property.initializer.text)) continue;

          found.push({ type: property.initializer.text, file: relative(root, filePath) });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

/** `src/modules/<slice>/…` → `<slice>`. */
function sliceOf(file: string): string | null {
  return /^src\/modules\/([^/]+)\//.exec(file)?.[1] ?? null;
}

function scanRepository(): Publication[] {
  return collectSourceFiles(join(root, 'src/modules'))
    .filter((path) => {
      const file = relative(root, path);
      // The realtime slice defines the vocabulary; it must not also satisfy it.
      if (file.startsWith('src/modules/realtime/')) return false;
      // A component naming an event type is subscribing, not publishing.
      return !file.includes('/ui/');
    })
    .flatMap((path) => findPublications(path, readFileSync(path, 'utf8')));
}

describe('every realtime event type is published by its owning slice', () => {
  const publications = scanRepository();

  const publishersOf = (type: string) =>
    new Set(
      publications
        .filter((publication) => publication.type === type)
        .flatMap((publication) => sliceOf(publication.file) ?? [])
    );

  it('pins the vocabulary to architecture §4', () => {
    // If §4 gains a type, this list and `OWNERS` both have to gain it too —
    // which is the moment someone has to say which slice will emit it.
    expect([...REALTIME_EVENT_TYPES].sort()).toEqual(Object.keys(OWNERS).sort());
  });

  it.each(REALTIME_EVENT_TYPES)('%s is published by its owner', (type) => {
    const publishers = publishersOf(type);

    expect(
      publishers.size,
      `No slice publishes "${type}". A realtime type nothing emits is a subscription that never fires.`
    ).toBeGreaterThan(0);

    expect(
      [...publishers],
      `"${type}" is owned by the ${OWNERS[type]} slice, but only ${[...publishers].join(', ')} publishes it.`
    ).toContain(OWNERS[type]);
  });

  it('finds real publications and ignores decoys (fixture)', () => {
    // Non-vacuity. The fixture carries both shapes this repo uses plus a
    // non-realtime `type` and a realtime type in a *filter* array; a scanner
    // that matched text rather than structure would return four, not two.
    const filePath = join(root, 'tests/fixtures/realtime-publish.fixture.ts');
    const found = findPublications(filePath, readFileSync(filePath, 'utf8'));

    expect(found.map((publication) => publication.type).sort()).toEqual([
      'completion.created',
      'event.deleted',
      'sync.status',
    ]);
  });

  it('reports no publication from an unexpected slice', () => {
    // Every publication belongs to a slice this test knows about; a new
    // publisher appearing somewhere else is a boundary decision, not a detail.
    const slices = new Set(publications.flatMap((publication) => sliceOf(publication.file) ?? []));
    expect([...slices].sort()).toEqual([
      'calendar',
      'devices',
      'google',
      'rewards',
      'routines',
      'timers',
    ]);
  });
});
