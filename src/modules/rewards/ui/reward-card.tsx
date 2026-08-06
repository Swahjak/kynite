'use client';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { StoreTile } from '../page-data';
import { CATEGORY_TILE } from './tokens';

/**
 * One reward on the child's shelf, in one of its three readings.
 *
 * - **Affordable** — a vivid, full-colour tile that is entirely one tap. No
 *   menu, no confirm dialog, no quantity picker (research §"Yoto/Tonies": one
 *   large tap, no menus).
 * - **Out of reach** — the *same* tile at one reduced opacity, plus a forward
 *   hint: "7 more stars". It is not locked, not crossed out, not greyscale, and
 *   the hint counts *up* to something rather than reporting a shortfall. The
 *   one treatment this product has for "not yet" is dimming, and it is the same
 *   dimming the routine board uses (research §Decisions 1).
 * - **Requested** — an hourglass over a settled tile: the question has been
 *   asked and the answer is somebody else's. Deliberately *not* a spinner: a
 *   spinner implies seconds, and this may take until after dinner.
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
  /** e.g. "5 stars" — the price, on every tile in every state. */
  cost: string;
  /** e.g. "7 more stars" — only for `outOfReach`. */
  shortHint: string;
  /** e.g. "Asked — waiting for an answer". Only for `requested`. */
  requestedLabel: string;
  /** Accessible name of the tap target, e.g. "Ask for Extra bedtime story". */
  actionLabel: string;
};

export type RewardCardProps = {
  tile: StoreTile;
  copy: RewardCardCopy;
  onRequest?: (origin: { x: number; y: number }) => void;
};

export function RewardCard({ tile, copy, onRequest }: RewardCardProps) {
  const affordable = tile.state === 'affordable';
  const requested = tile.state === 'requested';

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'flex size-20 shrink-0 items-center justify-center rounded-full transition-transform duration-300',
          affordable ? CATEGORY_TILE[tile.category] : 'bg-muted text-ink-secondary'
        )}
      >
        <Icon name={tile.icon} size="2xl" filled={affordable} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
        <span className="font-display text-h3 font-bold text-foreground">{tile.title}</span>
        {tile.state === 'outOfReach' ? (
          // Hopeful, not a shortfall: it names what arrives next, in the same
          // quiet ink the rest of the board's secondary text uses. Never an
          // alarm colour — "not yet" is not a problem.
          <span data-testid="reward-short-hint" className="text-caption text-ink-secondary">
            {copy.shortHint}
          </span>
        ) : null}
      </span>

      <span
        data-testid="reward-cost"
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-4xl px-4 py-2 font-bold',
          affordable ? 'bg-gold/25 text-gold-ink' : 'bg-muted text-ink-secondary'
        )}
      >
        <Icon name="star" size="sm" filled />
        <span className="tabular-time">{tile.costStars}</span>
        <span className="sr-only">{copy.cost}</span>
      </span>
    </>
  );

  const shell = cn(
    'relative flex min-h-[200px] w-full flex-col items-center gap-4 rounded-3xl p-6 text-center transition-all duration-200 ease-brand',
    affordable
      ? 'bg-card shadow-sm ring-1 ring-foreground/10 hover:-translate-y-1 hover:shadow-md active:scale-[0.99]'
      : 'bg-card shadow-sm ring-1 ring-foreground/5',
    // One opacity, no colour change, no border, no icon — the same treatment a
    // routine that has not started yet gets. Applied to `outOfReach` only: a
    // requested tile is already settled *under its own overlay*, and dimming
    // the whole thing a second time would fade the badge along with it.
    tile.state === 'outOfReach' && 'opacity-60',
    // A requested tile settles its own content instead of being covered by it,
    // so the child can still see *which* reward they asked for. The badge below
    // is excluded from the fade — the answer they are waiting for is the one
    // thing on this tile that must stay legible.
    requested && '[&>span:not([data-testid="reward-requested"])]:opacity-40'
  );

  return (
    <li data-testid="reward-tile" data-reward-id={tile.id} data-state={tile.state}>
      {affordable && onRequest ? (
        <button
          type="button"
          data-testid="reward-tap"
          aria-label={copy.actionLabel}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            onRequest({
              x: (box.left + box.width / 2) / Math.max(window.innerWidth, 1),
              y: (box.top + box.height / 2) / Math.max(window.innerHeight, 1),
            });
          }}
          className={cn(shell, 'focus-visible:ring-3 focus-visible:ring-ring/50')}
        >
          {body}
        </button>
      ) : (
        <div className={shell} aria-disabled={requested ? undefined : true}>
          {body}

          {requested ? (
            <span
              data-testid="reward-requested"
              className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 rounded-b-3xl bg-accent px-4 py-3 text-center"
            >
              <Icon name="hourglass_top" size="md" className="shrink-0 text-brand-ink" />
              <span className="font-display text-body-sm font-bold text-brand-ink">
                {copy.requestedLabel}
              </span>
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}
