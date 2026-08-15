// Fixture: the share view read path may deep-import another slice's `queries`,
// `domain`, `authorize` or `schema` — all action-free by construction — and
// nothing else, barrels least of all. Excluded from `pnpm lint` and from
// `tsconfig.json` because the imports below intentionally do not resolve.
import { decide } from '@/modules/family/authorize';
import { listMembers } from '@/modules/family/queries';
import { toDateKey } from '@/modules/calendar/domain/zone';
import { event } from '@/modules/calendar/schema';
import { loadCalendarPage } from '@/modules/calendar';
import { createEventAction } from '@/modules/calendar/actions';
import { EventChip } from '@/modules/calendar/ui/event-chip';

export const shareViewImports = [
  decide,
  listMembers,
  toDateKey,
  event,
  loadCalendarPage,
  createEventAction,
  EventChip,
];
