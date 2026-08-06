/**
 * Step ordering. Pure: takes rows, returns rows.
 *
 * `sortOrder` is the contract between the builder and the hub — a routine is a
 * *sequence* (research §"Habit formation": consistent day-to-day icon sequences
 * are what let a child anticipate what is next), so the order a parent arranges
 * is the order the child sees, and it has to survive a page reload rather than
 * living in component state.
 */

/** The shape both the schema row and the builder's draft rows satisfy. */
export type Orderable = { id: string; sortOrder: number };

/**
 * Rows in board order. Ties break on `id` rather than on insertion order so
 * the sequence is the same on every render and in every snapshot — two steps
 * that were saved with the same `sortOrder` must not swap between reloads.
 */
export function orderSteps<T extends Orderable>(steps: readonly T[]): T[] {
  return [...steps].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * Dense 0..n-1 `sortOrder` values for a list already in the intended order.
 *
 * Renumbering on every save (rather than patching the moved row) is what keeps
 * gaps and duplicates from accumulating: the stored order is always a
 * canonical sequence, which is also what makes `orderSteps` total.
 */
export function withSortOrder<T>(steps: readonly T[]): (T & { sortOrder: number })[] {
  return steps.map((step, index) => ({ ...step, sortOrder: index }));
}

export type MoveDirection = 'up' | 'down';

/**
 * One step moved one place, renumbered. A move off either end is a no-op
 * rather than an error — the button is simply disabled there.
 */
export function moveStep<T extends Orderable>(
  steps: readonly T[],
  stepId: string,
  direction: MoveDirection
): T[] {
  const ordered = orderSteps(steps);
  const from = ordered.findIndex((step) => step.id === stepId);
  if (from === -1) return ordered;

  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= ordered.length) return ordered;

  const moved = [...ordered];
  [moved[from], moved[to]] = [moved[to], moved[from]];

  return moved.map((step, index) => ({ ...step, sortOrder: index }));
}

/** How far along a routine is, as a 0..1 fraction. Empty routines read as 0. */
export function completionRatio(total: number, done: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}
