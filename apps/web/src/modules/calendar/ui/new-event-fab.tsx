'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Fab } from '@/components/ui/fab';
import type { Member } from '@/modules/family';
import { EventDialog, type WritableCalendar } from './event-dialog';

/**
 * The shell's FAB, wired to "new event" (M19,
 * `docs/rebuild-design-gaps.md` §2: "**FAB**, 64px, `rounded-2xl`,
 * bottom-right… No FAB anywhere").
 *
 * It lives in the calendar slice rather than in `modules/today` because the
 * thing it opens does: `EventDialog` is this slice's component, and a client
 * component in another slice cannot reach it — `@/modules/calendar` re-exports
 * `server-only` queries, so importing the barrel from the browser graph fails
 * the build, and the deep import is banned by `eslint.config.mjs`. Owning the
 * pairing here means any page can mount a create-event FAB with one element and
 * the props it already has.
 *
 * `<Fab>` portals into the shell's `FabSlot`, so this renders in place and
 * appears bottom-right (`components/ui/fab.tsx`). A principal without
 * `event:write` gets no FAB at all rather than one that opens a dialog every
 * submit would refuse.
 */
export type NewEventFabProps = {
  members: Member[];
  calendars: WritableCalendar[];
  timeZone: string;
  /** Prefilled start — "now, rounded up" on `/today`. */
  defaultStart?: Date;
  /** False for a read-only principal: the FAB is not rendered. */
  canWrite?: boolean;
};

export function NewEventFab({
  members,
  calendars,
  timeZone,
  defaultStart,
  canWrite = true,
}: NewEventFabProps) {
  const t = useTranslations('calendar');
  const [open, setOpen] = useState(false);

  if (!canWrite) return null;

  return (
    <>
      <Fab icon="add" label={t('actions.add')} onClick={() => setOpen(true)} />
      {/* Remounted per opening, so every field re-seeds from `defaultStart`
          instead of keeping the state of the last create that was cancelled —
          the same `key` trick `CalendarShell` uses on its own dialog. */}
      {open ? (
        <EventDialog
          key={String(defaultStart?.getTime() ?? 'now')}
          open={open}
          onOpenChange={setOpen}
          members={members}
          calendars={calendars}
          timeZone={timeZone}
          defaultStart={defaultStart}
        />
      ) : null}
    </>
  );
}
