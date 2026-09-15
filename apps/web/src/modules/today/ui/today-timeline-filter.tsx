'use client';

/**
 * The day list's member filter — the August sheet's replacement for the "Per
 * persoon" column that used to sit beside it.
 *
 * The column answered "what does Tom's day look like" by repeating the whole
 * day once per member, in a third of the board's width. This answers it in
 * place: pick a face and the list beside it narrows to that person's events.
 *
 * ## Why the rows arrive pre-rendered
 *
 * Every row is built on the server — it formats times in the household's
 * timezone and locale, resolves categories and reads translations, none of
 * which belongs in the browser bundle. So this component never renders a row;
 * it receives them as `ReactNode` alongside the member ids each one is for,
 * and decides which to show. Filtering is a `filter()` over an array that is
 * already in the page: no request, no spinner, no loading state to design.
 *
 * ## Why the selection is not remembered
 *
 * Unlike the tab (`use-today-tab.ts`), which is a per-device habit, a filter is
 * a *question* — "what does Mila have today" — and it is asked and answered in
 * one look. A wall tablet that stayed filtered on one child after somebody
 * walked away would be quietly lying about the household's day, which is the
 * one thing this screen must not do. It resets on every load, and the hub's own
 * idle-return brings it back to "Iedereen" without anyone tapping.
 */

import type { ReactNode } from 'react';
import { useTodayFilter } from './today-filter-context';

export type TimelineFace = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** `MEMBER_COLOR_CLASSES[color].track`, resolved by the server component. */
  surfaceClass: string;
};

export type TodayTimelineFilterProps = {
  /** The list's own heading, which shares its row with the filter controls. */
  heading: ReactNode;
  /**
   * The rows, in order. `memberIds` is who the row is *for* — a household-wide
   * event carries everyone, so it survives every filter, which is right: a
   * family dinner is on Mila's day too.
   */
  rows: { id: string; memberIds: string[]; node: ReactNode }[];
  /** Rendered above the rows whatever the filter says — the "already done" line. */
  disclosure?: ReactNode;
  /** Rendered at the right of the heading row, e.g. the past-rows toggle. */
  headerEnd?: ReactNode;
  /** Shown when the chosen person has nothing left today. */
  emptyLabel: string;
};

export function TodayTimelineFilter({
  heading,
  rows,
  disclosure,
  headerEnd,
  emptyLabel,
}: TodayTimelineFilterProps) {
  const filter = useTodayFilter();
  const selected = filter?.selected ?? null;

  const shown = selected === null ? rows : rows.filter((row) => row.memberIds.includes(selected));

  return (
    <>
      <div className="flex items-center gap-3 px-3">
        <div className="min-w-0 flex-1">{heading}</div>
        {selected === null ? headerEnd : null}
      </div>

      <div className="flex flex-col">
        {/* Only while unfiltered: "1 afgerond" counts the whole household's
            morning, and leaving it under a filtered list would make it read as
            that person's. */}
        {selected === null ? disclosure : null}
        {shown.length === 0 ? (
          <p className="px-3 py-2 text-body-sm text-ink-secondary">{emptyLabel}</p>
        ) : (
          shown.map((row) => <div key={row.id}>{row.node}</div>)
        )}
      </div>
    </>
  );
}
