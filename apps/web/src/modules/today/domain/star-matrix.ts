import { ICON_CODEPOINTS, type IconName } from '@/components/ui/icon-codepoints';

/**
 * The shape of the "Sterren vandaag" matrix — steps down the left, one column
 * per child (`docs/design/vandaag-template.html`, the `isSterren` panel).
 *
 * Pure on purpose: the loader in `../page-data.ts` produces one flat list of
 * today's steps per child, and this file decides what a *row* is. That decision
 * is the only non-obvious thing about the panel, so it lives somewhere it can
 * be read and tested without a database.
 *
 * ## Why rows have to be inferred at all
 *
 * A `routine` belongs to exactly one member (`routine.ownerMemberId`), so a
 * `routineStep` belongs to one child too. Two children brushing their teeth own
 * two different step rows with two different ids — there is no shared step in
 * the data model, and there is nothing to join on. A matrix keyed by step id
 * would therefore be a staircase: every child would get their own set of rows
 * with blanks everywhere else, which is exactly the layout the panel exists to
 * avoid.
 *
 * So rows are matched on what a parent actually reads: the step's **title**
 * (case- and whitespace-insensitive) together with its **icon**. "Tanden
 * poetsen" for Mila and "Tanden poetsen" for Daan share a row; "Tas inpakken"
 * that only Mila has gets a row where Daan's cell is empty.
 *
 * Two consequences are deliberate:
 *
 * - **A child can hold a row only once.** A title that repeats for the same
 *   child (a morning *and* an evening "Tanden poetsen") is two genuinely
 *   different pieces of work, so the second occurrence opens a second row
 *   rather than overwriting the first. The `#n` suffix in the row key is that
 *   occurrence counter.
 * - **An empty cell is not a missed step.** It means this child has no such
 *   step today, so it renders as an em-dash and is not tappable — ticking it
 *   would have nothing to write. Nothing on this page ever marks a child
 *   (`tests/unit/no-negative-marking.test.ts`).
 */

/** One child's step for today, flattened out of their routines. */
export type StarMatrixStep = {
  routineId: string;
  stepId: string;
  title: string;
  icon: IconName;
  /** The logical day this step is being satisfied on — grace days included. */
  occurrenceDate: string;
  done: boolean;
  /** Idempotency key, derived exactly as the hub board derives it (§4). */
  clientId: string;
};

/** A child, reduced to what the row builder needs. */
export type StarMatrixMember = {
  memberId: string;
  steps: readonly StarMatrixStep[];
};

export type StarMatrixRow = {
  /** Stable across renders and across children — safe as a React key. */
  key: string;
  title: string;
  icon: IconName;
  /** `memberId` → that child's step, or absent when they have no such step. */
  cells: ReadonlyMap<string, StarMatrixStep>;
};

/** A step may carry its own glyph; anything outside the subset font falls back. */
export function resolveStepIcon(icon: string | null, fallback: IconName): IconName {
  return icon && icon in ICON_CODEPOINTS ? (icon as IconName) : fallback;
}

function baseKeyOf(step: StarMatrixStep): string {
  return `${step.icon}:${step.title.trim().toLocaleLowerCase()}`;
}

/**
 * The union of every child's steps for today, in first-appearance order.
 *
 * Order follows the children (already sorted by `sortOrder`) and, within a
 * child, their own board order — so a household with one child sees exactly
 * their routine, top to bottom, and a second child's extra steps append below
 * the shared ones instead of shuffling them.
 */
export function starMatrixRows(members: readonly StarMatrixMember[]): StarMatrixRow[] {
  const rows: { key: string; title: string; icon: IconName; cells: Map<string, StarMatrixStep> }[] =
    [];
  const byKey = new Map<string, (typeof rows)[number]>();

  for (const member of members) {
    // Per child, because the counter answers "the *n*th time this child has a
    // step by this name", not "the nth time anyone does".
    const seen = new Map<string, number>();

    for (const step of member.steps) {
      const base = baseKeyOf(step);
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);

      const key = occurrence === 1 ? base : `${base}#${occurrence}`;
      let row = byKey.get(key);

      if (!row) {
        row = { key, title: step.title, icon: step.icon, cells: new Map() };
        byKey.set(key, row);
        rows.push(row);
      }

      row.cells.set(member.memberId, step);
    }
  }

  return rows.map((row) => ({ key: row.key, title: row.title, icon: row.icon, cells: row.cells }));
}
