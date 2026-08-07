// Fixture: the `(share)` route tree may import `@/modules/sharing/view` and
// nothing else from `modules/` — every slice barrel re-exports Server Actions,
// and every other slice module is one hop from one. Excluded from `pnpm lint`
// and from `tsconfig.json` because the imports below intentionally do not
// resolve.
import { loadShareView } from '@/modules/sharing/view';
import { createShareLinkAction } from '@/modules/sharing/actions';
import { loadCalendarPage } from '@/modules/calendar';
import { listEvents } from '@/modules/calendar/queries';

export const shareTreeImports = [
  loadShareView,
  createShareLinkAction,
  loadCalendarPage,
  listEvents,
];
