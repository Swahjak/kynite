import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Enums two slices' tables both need.
 *
 * There is exactly one so far, and it is here for a structural reason rather
 * than a tidiness one. `event.event_type` belongs to the calendar slice, and
 * `calendar.default_type` — the type an untyped event inherits (M23) — belongs
 * to the google slice. `modules/calendar/schema.ts` already imports
 * `modules/google/schema.ts` for the `calendar` foreign key, so declaring the
 * enum on the calendar side and importing it back would put a cycle between
 * two `pgTable` modules. Drizzle evaluates those at import time, so one side
 * would hold `undefined` and the failure would surface as a broken column
 * definition rather than as an import error.
 *
 * `server/db` is the schema assembly point (docs/architecture.md §2), which is
 * where both slices already reach for `primaryId`/`timestamps`. A shared enum
 * is the same kind of fact.
 */

/**
 * What an event *is*, in the vocabulary a family uses — the M23 taxonomy.
 *
 * Re-exported by `modules/calendar/schema.ts`, which is where the reasoning
 * behind the eleven values (and behind them being the only thing that colours
 * an event) is written down. Import it from there unless you are a table
 * module that cannot.
 */
export const eventType = pgEnum('event_type', [
  'school',
  'childcare',
  'sport',
  'music',
  'play',
  'health',
  'family',
  'birthday',
  'holiday',
  'work',
  'other',
]);
