'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@kynite/ui';
import type { Member } from '@/modules/family';
import { EventDialog, type WritableCalendar } from './event-dialog';

/**
 * "Nieuw event" as a tile in the board's quick-action grid.
 *
 * Same pairing as `NewEventFab`, and here for the same reason: `EventDialog`
 * belongs to this slice, and a client component in `modules/today` cannot reach
 * it — importing `@/modules/calendar` from the browser graph pulls
 * `server-only` queries, and the deep import is banned by `eslint.config.mjs`.
 * So the slice that owns the dialog owns the button that opens it, and the
 * board mounts it with the props it already has.
 *
 * A principal without `event:write` renders nothing at all, rather than a tile
 * that opens a dialog every submit would refuse. On the wall that is *every*
 * principal — a device is `deny` for `event:write` (§7) — which is why the
 * board's grid is shorter there than the design sheet's.
 */
export type NewEventActionProps = {
  members: Member[];
  calendars: WritableCalendar[];
  timeZone: string;
  /** Prefilled start — the day being shown, not "now", when browsing. */
  defaultStart?: Date;
  canWrite?: boolean;
};

export function NewEventAction({
  members,
  calendars,
  timeZone,
  defaultStart,
  canWrite = true,
}: NewEventActionProps) {
  const t = useTranslations('today');
  const [open, setOpen] = useState(false);

  if (!canWrite) return null;

  return (
    <>
      <Button
        variant="outline"
        data-testid="today-action-event"
        className="min-h-14 justify-start gap-2.5 rounded-2xl px-4 font-display text-body font-bold"
        onClick={() => setOpen(true)}
      >
        <Icon name="event" size="md" className="text-brand" />
        {t('actions.newEvent')}
      </Button>

      {/* Remounted per opening so every field re-seeds from `defaultStart`,
          the same `key` trick `NewEventFab` and `CalendarShell` use. */}
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
