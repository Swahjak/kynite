/**
 * What an event is *called* on screen — the one place that decides it.
 *
 * An event can reach a surface without a usable title in three different ways,
 * and until this file existed each surface had to remember all three:
 *
 * - **The Google sentinel.** Google's API omits `summary` entirely for an event
 *   somebody created by dragging a slot and never naming. M05's mapper cannot
 *   store nothing — `title` is `not null` — so it stores the literal string
 *   `(no title)` (`modules/google/domain/mapping.ts`, and the ICS importer
 *   agrees in `modules/ics/domain/parse.ts`). That literal is English, it is a
 *   marker rather than a name, and a Dutch wall display must never show it.
 * - **Empty, or whitespace.** A locally created event whose title was cleared,
 *   or an ICS `SUMMARY:` with nothing after the colon.
 * - **Redaction.** A private Google calendar synced free/busy-only still
 *   carries whatever title it had; `busyOnly` says the family may not see it.
 *
 * Three surfaces used to compare against a locally re-declared sentinel —
 * `ui/event-chip.tsx`, `ui/day-agenda-row.tsx`, `sharing/view/share-board.tsx`
 * — and `/today`'s two (`today-timeline.tsx`, `today-tab-personen.tsx`) simply
 * did not, so a synced nameless event rendered the literal "(no title)" on the
 * hub. Four hand-copied comparisons are four chances to forget the fifth.
 *
 * ## Why the sentinel lives *here* and not in the Google slice
 *
 * The three copies each carried a comment explaining that importing `UNTITLED`
 * from `modules/google/domain/mapping.ts` would be wrong — a calendar-UI
 * component has no business depending on the Google sync integration for a
 * string, and the `(share)` route tree may not reach anything Google-adjacent
 * at all (`eslint.config.mjs`, `shareTreeRule`). That reasoning is sound; the
 * conclusion it reached — copy the literal — was not. The calendar slice's
 * `domain/` is the shared ground both sides may legitimately import: the share
 * view is explicitly allowed to deep-import another slice's `domain`
 * (`shareViewBoundaryRule`), and the writers (`google`, `ics`) can align on it
 * without anyone importing anyone's UI.
 *
 * ## Why the labels are parameters
 *
 * `domain/` is framework-free and cannot call `useTranslations`, and it should
 * not: the same rule has to serve a client component, a server component and
 * the share tree's own `getTranslations`. The caller passes the strings it
 * already has — `t('untitled')`, `t('busy')` — and this decides *which* one.
 */

/**
 * The placeholder a nameless synced event carries in the database.
 *
 * Mirrored by `UNTITLED` in `modules/google/domain/mapping.ts` and
 * `modules/ics/domain/parse.ts`, which are the two writers. Those keep their
 * own constant because they are the *producing* side and must not depend on a
 * reading slice; this is the single constant every *reader* compares against.
 */
export const UNTITLED_TITLE = '(no title)';

/** The read subset of an event a title decision needs. */
export type TitledEvent = {
  title: string;
  /** Detail was withheld: a private calendar synced free/busy only. */
  busyOnly?: boolean;
};

export type TitleLabels = {
  /** Locale string for an event that has no name — `t('untitled')`. */
  untitled: string;
  /**
   * Locale string for a redacted event — `t('busy')`.
   *
   * Optional because it outranks everything else when present, and a surface
   * that draws its own busy treatment (a hatch, an italic span) may want to
   * decide that itself rather than have the label substituted underneath it.
   */
  busy?: string;
};

/**
 * The label to render for `event`.
 *
 * Precedence is redaction → missing → the title itself, in that order:
 * a redacted event's stored title must not leak even when it is the sentinel,
 * and the sentinel must not leak even though it is technically a string.
 *
 * The missing-title test is deliberately an **exact** match on the sentinel
 * plus an emptiness check on the trimmed value — never `includes`. "Vergadering
 * (no title) bespreken" is a title a parent typed, and blanking it would throw
 * away data the family put in. For the same reason the returned title is the
 * stored one, untrimmed: leading space in a real name is the family's own, and
 * layout, not this function, decides how to render it.
 */
export function titleOf(event: TitledEvent, { untitled, busy }: TitleLabels): string {
  if (event.busyOnly && busy !== undefined) return busy;
  if (event.title === UNTITLED_TITLE || event.title.trim() === '') return untitled;
  return event.title;
}
