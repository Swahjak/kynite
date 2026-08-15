'use client';

import { useCallback, useOptimistic, useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { CompleteStepInput, CompletionState, UndoCompletionInput } from '@/modules/routines';
import { useRouter } from '@/i18n/navigation';
import { starMatrixRows, type StarMatrixStep } from '../domain/star-matrix';

/**
 * "Sterren vandaag" — today's routine steps as a grid a parent can tick from
 * their own phone (`docs/design/vandaag-template.html`, the `isSterren` panel).
 *
 * Steps down the left, one column per child, a filled star where that child has
 * done it and an empty circle where they have not. Every circle and every star
 * is a button: this is the *parent's* correction surface, the counterpart to
 * the child's own board on the hub — "he did brush his teeth, he just forgot to
 * tap" is the case it exists for, and until now the only way to fix it was to
 * walk to the tablet.
 *
 * Three things it deliberately does **not** do:
 *
 * - **It does not write its own completion.** Both directions run the routines
 *   slice's own Server Actions, so a star ticked here is worth exactly what a
 *   star ticked on the hub is worth, is idempotent under the same `clientId`,
 *   and publishes the same events. A parallel write would be a second
 *   definition of what a completion *is*.
 * - **It does not celebrate.** Confetti and praise belong to the child who did
 *   the work, on the screen they did it on. A parent correcting a grid at the
 *   kitchen table gets a star that fills, and nothing else.
 * - **It does not mark anybody.** A step that is not done is an empty outline;
 *   a step a child does not *have* today is an em-dash, never a zero and never
 *   a cross (`tests/unit/no-negative-marking.test.ts`).
 *
 * The two actions and the column avatars arrive as **props** rather than
 * imports. This is a client component, and both `@/modules/routines` and
 * `@/modules/family` re-export `server-only` reads through their barrels, which
 * a browser module may not pull in; deep-importing past the barrel is banned
 * (architecture §2, `tests/unit/module-boundaries.test.ts`). Handing an action
 * reference and a rendered face down from the server tab keeps both rules and
 * costs this component nothing — it was never going to own either.
 *
 * The optimistic flip runs inside the *transition that includes the refresh*,
 * so a cell stays flipped until the server's own render lands and there is no
 * frame where the star pops back to empty. Rollback is safe here in a way it is
 * not on the hub: nothing has been celebrated, so a write that fails simply
 * leaves the cell showing what the server says, which is the truth.
 */

/** One child's column. `avatar` is rendered by the server — see above. */
export type StarMatrixColumn = {
  memberId: string;
  displayName: string;
  avatar: ReactNode;
  steps: StarMatrixStep[];
};

export type StarMatrixProps = {
  columns: StarMatrixColumn[];
  /** `completeStepAction`, handed down from the server tab. */
  completeStep: (input: CompleteStepInput) => Promise<CompletionState>;
  /** `undoCompletionAction`, likewise. */
  undoCompletion: (input: UndoCompletionInput) => Promise<CompletionState>;
  /**
   * What the completion ledger records this tap as (`completion_source`).
   *
   * Resolved by the surface, never by this component: the same grid is the
   * parent's correction surface on a phone and the household's own grid on the
   * wall tablet, and "which screen was this tapped on" is a fact about the
   * device, not about the star.
   */
  source: CompleteStepInput['source'];
  /**
   * `completion:write` for the surface's principal (§7). Every column of the
   * matrix grades `allow` except a viewer share link, so this is normally true
   * — but the gate is derived from the matrix rather than assumed, and a cell
   * that cannot be written is rendered as a read-only mark instead of a button
   * that would be refused.
   */
  canComplete: boolean;
};

type Patch = { clientId: string; done: boolean };

export function StarMatrix({
  columns,
  completeStep,
  undoCompletion,
  source,
  canComplete,
}: StarMatrixProps) {
  const t = useTranslations('today');
  const router = useRouter();
  const [, startTransition] = useTransition();

  /** `clientId` → the state this device has asked for, until the server agrees. */
  const [flipped, flip] = useOptimistic<ReadonlyMap<string, boolean>, Patch>(
    new Map<string, boolean>(),
    (previous, patch) => new Map(previous).set(patch.clientId, patch.done)
  );
  /**
   * Cells with a request in the air. Not a spinner — a *lock*: a second tap on
   * the same cell before the first settles would race a completion against the
   * undo of itself, and whichever lost would decide the outcome.
   */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const isDone = useCallback(
    (step: StarMatrixStep) => flipped.get(step.clientId) ?? step.done,
    [flipped]
  );

  const toggle = (step: StarMatrixStep, memberId: string) => {
    if (!canComplete || busy.has(step.clientId)) return;
    const next = !isDone(step);

    setBusy((previous) => new Set(previous).add(step.clientId));

    startTransition(async () => {
      flip({ clientId: step.clientId, done: next });

      try {
        if (next) {
          await completeStep({
            routineId: step.routineId,
            routineStepId: step.stepId,
            memberId,
            occurrenceDate: step.occurrenceDate,
            clientId: step.clientId,
            source,
          });
        } else {
          await undoCompletion({ clientId: step.clientId });
        }
      } finally {
        // Inside the transition, so the optimistic flip survives until the
        // server render that replaces it has committed.
        router.refresh();
        setBusy((previous) => {
          const rest = new Set(previous);
          rest.delete(step.clientId);
          return rest;
        });
      }
    });
  };

  const rows = starMatrixRows(columns);

  if (rows.length === 0) {
    return <p className="text-body-sm text-ink-secondary">{t('stars.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The grid is the one thing on this page allowed to scroll sideways —
          the page itself never does, however many children a family has. */}
      <div className="-mx-2 overflow-x-auto px-2">
        <table
          data-testid="star-matrix"
          // A grid of stars is a *table* of steps × children: the row and
          // column headers are what make a lone star cell mean something to a
          // screen reader, and a div-grid would have to fake all of it.
          className="w-full min-w-max border-collapse text-left"
        >
          <caption className="sr-only">{t('stars.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-full pb-3">
                <span className="sr-only">{t('stars.stepColumn')}</span>
              </th>
              {columns.map((column) => (
                <th key={column.memberId} scope="col" className="w-28 pb-3 align-bottom">
                  <span className="flex flex-col items-center gap-1.5">
                    {column.avatar}
                    <span className="font-display text-overline font-bold text-ink-muted uppercase">
                      {column.displayName}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.key} data-testid="star-matrix-row">
                <th scope="row" className="border-t border-line py-1.5 pr-4 font-normal">
                  <span className="flex items-center gap-2.5">
                    <Icon name={row.icon} size="sm" className="shrink-0 text-ink-muted" />
                    <span className="text-body-sm">{row.title}</span>
                  </span>
                </th>

                {columns.map((column) => {
                  const step = row.cells.get(column.memberId);

                  if (!step) {
                    return (
                      <td
                        key={column.memberId}
                        className="border-t border-line text-center text-body-sm text-ink-muted"
                      >
                        <span aria-hidden>—</span>
                        <span className="sr-only">
                          {t('stars.noStep', { name: column.displayName })}
                        </span>
                      </td>
                    );
                  }

                  const done = isDone(step);

                  return (
                    <td key={column.memberId} className="border-t border-line text-center">
                      <button
                        type="button"
                        data-testid="star-cell"
                        data-state={done ? 'done' : 'todo'}
                        aria-pressed={done}
                        aria-label={t('stars.toggle', {
                          step: row.title,
                          name: column.displayName,
                        })}
                        disabled={!canComplete || busy.has(step.clientId)}
                        onClick={() => toggle(step, column.memberId)}
                        className={cn(
                          // 44px, the touch minimum, on a control a thumb aims
                          // at across a breakfast table.
                          'mx-auto flex size-11 items-center justify-center rounded-full transition-colors duration-200 ease-brand',
                          'hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50',
                          'disabled:pointer-events-none disabled:opacity-70'
                        )}
                      >
                        {done ? (
                          <Icon name="star" filled size="md" className="text-gold" />
                        ) : (
                          <Icon
                            name="radio_button_unchecked"
                            size="md"
                            className="text-ink-muted/60"
                          />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-4">
        <span className="flex items-center gap-1.5 text-caption text-ink-secondary">
          <Icon name="info" size="sm" />
          {t('stars.hint')}
        </span>

        <div className="flex flex-wrap items-center gap-3.5">
          <span className="text-caption text-ink-secondary">{t('stars.summaryLabel')}</span>
          {columns.map((column) => {
            const done = column.steps.filter((step) => isDone(step)).length;

            return (
              <span key={column.memberId} className="text-caption text-ink-secondary">
                {column.displayName}{' '}
                <b className="tnum text-ink">
                  {done}/{column.steps.length}
                </b>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
