'use server';

/**
 * A Server Action, three hops away from the fixture entry point.
 *
 * The scanner in `tests/unit/share-tree-no-server-actions.test.ts` must reach
 * it. A checker that only looked at an entry file's *direct* imports would
 * call this tree clean, which is precisely the failure mode that would let a
 * mutation into `(share)` through one helper module or one barrel re-export.
 */
export async function renameEveryoneAction(): Promise<void> {}
