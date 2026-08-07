'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon-codepoints';
import { cn } from '@/lib/utils';
import { idleState } from '../action-state';
import { decideRedemptionAction, fulfillRedemptionAction } from '../actions';
import type { RedemptionWithReward } from '../queries';
import { rewardIconOf } from './tokens';

/**
 * The parent's approval queue (§7 `redemption:approve`).
 *
 * A queue, not a feed: open requests are shown **oldest first**, because the
 * child who asked yesterday morning is the one still waiting. Every other list
 * in this app is newest-first; this one is deliberately not.
 *
 * The two decisions are given equal visual weight. Denying is not styled as
 * destructive and approving is not styled as the "correct" answer — a parent
 * saying no to a zoo trip on a Tuesday is an ordinary, healthy outcome, and a
 * UI that made it feel like a failure would push towards yes. Neither button
 * asks for confirmation: both are reversible in the only way that matters
 * (the child can ask again tomorrow), and a denial costs nothing at all —
 * `member_star_balance` never counts a denied row, so the child's stars are
 * exactly where they were.
 */

function DecideButtons({ redemptionId }: { redemptionId: string }) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(decideRedemptionAction, idleState);

  return (
    <form action={formAction} className="flex shrink-0 flex-wrap items-center gap-2">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <Button
        type="submit"
        name="decision"
        value="approve"
        size="hub"
        disabled={pending}
        data-testid="approve-redemption"
      >
        <Icon name="check" size="md" inline="start" />
        {t('actions.approve')}
      </Button>
      <Button
        type="submit"
        name="decision"
        value="deny"
        variant="outline"
        size="hub"
        disabled={pending}
        data-testid="deny-redemption"
      >
        {t('actions.deny')}
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="text-sm text-ink-secondary">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}

function FulfillButton({ redemptionId }: { redemptionId: string }) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(fulfillRedemptionAction, idleState);

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <Button
        type="submit"
        variant="outline"
        size="hub"
        disabled={pending}
        data-testid="fulfill-redemption"
      >
        {t('actions.fulfill')}
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}

function Row({
  entry,
  memberName,
  children,
}: {
  entry: RedemptionWithReward;
  memberName: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations('rewards');

  return (
    <li>
      <Card
        data-testid="redemption-row"
        data-redemption-id={entry.id}
        data-status={entry.status}
        className="transition-shadow duration-200 ease-brand hover:shadow-md"
      >
        <CardContent className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full',
              // Only what is still waiting on a parent carries the brand tint;
              // settled rows go quiet. A queue that shouts at every row is a
              // queue nobody reads.
              entry.status === 'requested'
                ? 'bg-brand-container text-brand-container-ink'
                : 'bg-surface-container text-ink-secondary'
            )}
          >
            <Icon
              name={rewardIconOf(entry.rewardIcon)}
              size="lg"
              filled={entry.status === 'requested'}
            />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-display text-h3 font-bold">{entry.rewardTitle}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{memberName}</Badge>
              <Badge variant="gold">{t('starsCost', { count: entry.costStars })}</Badge>
              <Badge variant="outline">{t(`statuses.${entry.status}`)}</Badge>
            </span>
          </div>

          {children}
        </CardContent>
      </Card>
    </li>
  );
}

/**
 * A section heading with the stitch icon medallion beside it. Three sections,
 * three glyphs, so a parent scanning the page finds "what needs me" without
 * reading — `hourglass_top` waits, `redeem` is owed, `check_circle` is done.
 */
function QueueHeading({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-h2 font-bold">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container text-ink-secondary"
      >
        <Icon name={icon} size="md" />
      </span>
      {children}
    </h2>
  );
}

export function ApprovalQueue({
  pending,
  outstanding,
  history,
  memberNames,
  canApprove,
}: {
  pending: RedemptionWithReward[];
  outstanding: RedemptionWithReward[];
  history: RedemptionWithReward[];
  /**
   * `memberId → display name`, as a plain object rather than a lookup
   * *function*: this is a `'use client'` boundary, and a function prop cannot
   * cross it (React refuses to serialise one). The map is the serialisable
   * shape of the same thing.
   */
  memberNames: Record<string, string>;
  canApprove: boolean;
}) {
  const t = useTranslations('rewards');
  const nameOf = (memberId: string) => memberNames[memberId] ?? '';

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <QueueHeading icon="hourglass_top">{t('queue.pendingTitle')}</QueueHeading>
        {pending.length === 0 ? (
          <p data-testid="queue-empty" className="text-body-lg text-ink-secondary">
            {t('queue.pendingEmpty')}
          </p>
        ) : (
          <ul data-testid="approval-queue" className="flex flex-col gap-3">
            {pending.map((entry) => (
              <Row key={entry.id} entry={entry} memberName={nameOf(entry.memberId)}>
                {canApprove ? <DecideButtons redemptionId={entry.id} /> : null}
              </Row>
            ))}
          </ul>
        )}
      </section>

      {outstanding.length > 0 ? (
        <section className="flex flex-col gap-4">
          <QueueHeading icon="redeem">{t('queue.outstandingTitle')}</QueueHeading>
          <p className="text-body-sm text-ink-secondary">{t('queue.outstandingHint')}</p>
          <ul data-testid="outstanding-queue" className="flex flex-col gap-3">
            {outstanding.map((entry) => (
              <Row key={entry.id} entry={entry} memberName={nameOf(entry.memberId)}>
                {canApprove ? <FulfillButton redemptionId={entry.id} /> : null}
              </Row>
            ))}
          </ul>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="flex flex-col gap-4">
          <QueueHeading icon="check_circle">{t('queue.historyTitle')}</QueueHeading>
          <ul data-testid="redemption-history" className="flex flex-col gap-3">
            {history.map((entry) => (
              <Row key={entry.id} entry={entry} memberName={nameOf(entry.memberId)} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
