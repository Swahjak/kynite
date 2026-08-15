'use client';

import { useState, type ReactNode } from 'react';
import { Badge, Button, cn, MemberFace } from '@kynite/ui';

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

export type TimelineFace = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** `MEMBER_COLOR_CLASSES[color].surface`, resolved by the server component. */
  surfaceClass: string;
};

export type TodayTimelineFilterProps = {
  /** The list's own heading, which shares its row with the filter controls. */
  heading: ReactNode;
  faces: TimelineFace[];
  /**
   * The rows, in order. `memberIds` is who the row is *for* — a household-wide
   * event carries everyone, so it survives every filter, which is right: a
   * family dinner is on Mila's day too.
   */
  rows: { id: string; memberIds: string[]; node: ReactNode }[];
  /** Rendered above the rows whatever the filter says — the "already done" line. */
  disclosure?: ReactNode;
  /** "Iedereen" — the resting state's label. */
  everyoneLabel: string;
  /** Shown when the chosen person has nothing left today. */
  emptyLabel: string;
};

export function TodayTimelineFilter({
  heading,
  faces,
  rows,
  disclosure,
  everyoneLabel,
  emptyLabel,
}: TodayTimelineFilterProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const shown = selected === null ? rows : rows.filter((row) => row.memberIds.includes(selected));

  return (
    <>
      <div className="flex items-center gap-3 px-3">
        <div className="min-w-0 flex-1">{heading}</div>
        <div data-testid="today-timeline-filter" className="flex items-center gap-1.5">
          {/* The resting state is drawn as the selected pill rather than as one
            option among five, so an unfiltered day never looks like a filtered
            one somebody forgot to clear. */}
          <Badge
            variant={selected === null ? 'status' : 'outline'}
            size="lg"
            className="cursor-pointer"
            data-state={selected === null ? 'on' : 'off'}
            render={<button type="button" onClick={() => setSelected(null)} />}
          >
            {everyoneLabel}
          </Badge>

          {faces.map((face) => {
            const active = selected === face.id;
            return (
              <Button
                key={face.id}
                variant="ghost"
                size="icon-lg"
                aria-pressed={active}
                data-testid="today-timeline-filter-face"
                className={cn(
                  'rounded-full p-0 transition-opacity',
                  // Dimmed until chosen: at rest the faces are an affordance, not
                  // four competing statements about whose day this is.
                  active ? 'opacity-100 ring-2 ring-primary' : 'opacity-45 hover:opacity-80'
                )}
                onClick={() => setSelected(active ? null : face.id)}
              >
                <MemberFace
                  name={face.name}
                  avatarUrl={face.avatarUrl}
                  surfaceClass={face.surfaceClass}
                  size="default"
                />
              </Button>
            );
          })}
        </div>
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
