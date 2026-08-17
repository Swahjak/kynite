'use client';

import { cn } from '../lib/utils';
import { Button } from './button';
import { Icon } from './icon';
import type { IconName } from './icon-codepoints';

/**
 * One reward on the child's shelf, in one of its three readings
 * (`Beloningen.dc.html`).
 *
 * - **Affordable** — a white tile with the reward's own colour on its icon, the
 *   price in gold, and one button. No menu, no confirm dialog, no quantity
 *   picker (research §"Yoto/Tonies": one large tap, no menus).
 * - **Out of reach** — the *same* tile at one reduced opacity, with the price in
 *   quiet ink and a forward hint: "nog 12". It is not locked, not crossed out
 *   and not greyscale, and the hint counts *up* to something rather than
 *   reporting a shortfall. The one treatment this product has for "not yet" is
 *   dimming, and it is the same dimming the routine board uses (research
 *   §Decisions 1).
 * - **Requested** — the tile picks up the brand outline and its footer becomes
 *   a sentence: "Papa kijkt ernaar". The question has been asked and the answer
 *   is somebody else's. Deliberately *not* a spinner: a spinner implies
 *   seconds, and this may take until after dinner. The stars have not moved —
 *   asking is not spending.
 *
 * There is no fourth state. A denied request removes the badge and the tile
 * goes back to being an ordinary tile — no mark, no cooldown, no explanation
 * text, because a denial is a conversation and not an app mechanic.
 *
 * Presentational on purpose — it takes translated strings rather than calling
 * `useTranslations`, which is what lets a component test render it without a
 * locale provider and assert the *component's* contract.
 */

export type RewardCardCopy = {
  /** e.g. "5 sterren" — the price, on every tile in every state. */
  cost: string;
  /** e.g. "nog 12" — only for `outOfReach`. */
  shortHint: string;
  /** e.g. "Papa kijkt ernaar". Only for `requested`. */
  requestedLabel: string;
  /** Accessible name of the tap target, e.g. "Vraag Film uitkiezen aan". */
  actionLabel: string;
  /** The button's visible word, e.g. "Kiezen". Falls back to `actionLabel`. */
  action?: string;
  /** The eyebrow above the title, e.g. "Privilege". */
  category?: string;
};

/**
 * The read subset of the app's `StoreTile` (`modules/rewards/page-data.ts`),
 * restated so the package does not import the rewards slice. A `StoreTile` is
 * structurally assignable to it, which is why no call site changed.
 *
 * `category` is deliberately *not* here. The category → hue mapping is a
 * product decision (`modules/rewards/ui/tokens.ts` § `CATEGORY_TILE`), and the
 * design system's job is only to draw a tinted disc, so the caller hands over
 * the class pair it wants and the component never learns what a "treat" is.
 */
export type RewardTile = {
  id: string;
  title: string;
  icon: IconName;
  costStars: number;
  state: 'affordable' | 'outOfReach' | 'requested';
};

export type RewardCardProps = {
  tile: RewardTile;
  /**
   * The tile's icon colours, e.g. `CATEGORY_TILE[tile.category]` —
   * `bg-cat-blue-surface text-cat-blue-fg`. Ignored once out of reach, which
   * uses the neutral container.
   */
  tileClass?: string;
  copy: RewardCardCopy;
  onRequest?: (origin: { x: number; y: number }) => void;
};

export function RewardCard({ tile, tileClass, copy, onRequest }: RewardCardProps) {
  const affordable = tile.state === 'affordable';
  const requested = tile.state === 'requested';
  const reachable = affordable || requested;

  return (
    <li
      data-testid="reward-tile"
      data-reward-id={tile.id}
      data-state={tile.state}
      className={cn(
        'flex min-h-[230px] flex-col gap-2.5 rounded-xl border p-4.5',
        requested
          ? 'border-2 border-primary bg-accent'
          : affordable
            ? 'border-line-subtle bg-surface-container-lowest shadow-sm'
            : // One opacity, no colour change, no border change, no icon — the
              // same treatment a routine that has not started yet gets.
              'border-line-subtle bg-surface-container-low opacity-60'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-14 shrink-0 items-center justify-center rounded-md',
          requested
            ? 'bg-accent text-brand'
            : affordable
              ? tileClass
              : 'bg-surface-container text-ink-muted'
        )}
      >
        <Icon name={tile.icon} size="xl" filled />
      </span>

      <div className="min-w-0">
        {copy.category ? (
          <span
            className={cn(
              'label-overline block',
              requested ? 'text-brand' : reachable ? undefined : 'text-ink-muted'
            )}
          >
            {copy.category}
          </span>
        ) : null}
        <span
          className={cn(
            'mt-0.5 block font-display text-h3 leading-tight font-extrabold',
            reachable ? 'text-ink' : 'text-ink-secondary'
          )}
        >
          {tile.title}
        </span>
      </div>

      <span className="flex-1" />

      {requested ? (
        <span
          data-testid="reward-requested"
          className="flex items-center gap-2 rounded-2xl bg-card px-3.5 py-2.5 text-left font-display text-body-sm font-bold text-brand-ink"
        >
          <Icon name="hourglass_top" size="sm" className="shrink-0" />
          {copy.requestedLabel}
        </span>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span
            data-testid="reward-cost"
            className={cn(
              'flex items-center gap-1.5 font-display text-h2 font-extrabold',
              affordable ? 'text-gold-ink' : 'text-ink-muted'
            )}
          >
            <Icon name="star" filled size="md" />
            <span aria-hidden className="tnum">
              {tile.costStars}
            </span>
            <span className="sr-only">{copy.cost}</span>
          </span>

          {affordable && onRequest ? (
            <Button
              data-testid="reward-tap"
              aria-label={copy.actionLabel}
              size="hub"
              className="shrink-0"
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                onRequest({
                  x: (box.left + box.width / 2) / Math.max(window.innerWidth, 1),
                  y: (box.top + box.height / 2) / Math.max(window.innerHeight, 1),
                });
              }}
            >
              {copy.action ?? copy.actionLabel}
            </Button>
          ) : affordable ? null : (
            // Hopeful, not a shortfall: it names what arrives next, in the same
            // quiet ink the rest of the board's secondary text uses. Never an
            // alarm colour — "not yet" is not a problem.
            <span
              data-testid="reward-short-hint"
              className="tnum shrink-0 rounded-4xl border border-line-subtle bg-surface-container-lowest px-3.5 py-2 font-display text-body-sm font-bold text-ink-secondary"
            >
              {copy.shortHint}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
