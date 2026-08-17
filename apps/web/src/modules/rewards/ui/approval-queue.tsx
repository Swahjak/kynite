'use client';

import { useActionState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button, Card, Icon, MemberFace, Overline, StarCount } from '@kynite/ui';
import { idleState } from '../action-state';
import { decideRedemptionAction, fulfillRedemptionAction } from '../actions';
import type { RedemptionWithReward } from '../queries';

/**
 * The parent's approval queue (§7 `redemption:approve`) —
 * `Beloningen.dc.html`, mobile beheer.
 *
 * A queue, not a feed: open requests are shown **oldest first**, because the
 * child who asked yesterday morning is the one still waiting. Every other list
 * in this app is newest-first; this one is deliberately not, and it says so on
 * the screen ("oudste eerst").
 *
 * The two decisions are given equal visual weight. Denying is not styled as
 * destructive and approving is not styled as the "correct" answer — a parent
 * saying no to a zoo trip on a Tuesday is an ordinary, healthy outcome, and a
 * UI that made it feel like a failure would push towards yes. Neither button
 * asks for confirmation: both are reversible in the only way that matters
 * (the child can ask again tomorrow), and a denial costs nothing at all —
 * `member_star_balance` never counts a denied row, so the child's stars are
 * exactly where they were.
 *
 * The price on the card is the price the child asked at, frozen in
 * `redemption.costStars`. Re-pricing the catalogue never re-prices a request
 * that is already waiting.
 */

/** Face, name and colour for the child who asked — resolved server-side. */
export type QueueMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  colorClass: string;
  initials: string;
};

function useMemberLookup(members: QueueMember[]) {
  return (memberId: string): QueueMember =>
    members.find((entry) => entry.id === memberId) ?? {
      id: memberId,
      displayName: '',
      avatarUrl: null,
      colorClass: '',
      initials: '',
    };
}

function DecideButtons({ redemptionId }: { redemptionId: string }) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(decideRedemptionAction, idleState);

  return (
    <form action={formAction} className="flex gap-2">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <Button
        type="submit"
        name="decision"
        value="approve"
        className="min-h-11 flex-1 rounded-4xl"
        disabled={pending}
        data-testid="approve-redemption"
      >
        {t('actions.approve')}
      </Button>
      <Button
        type="submit"
        name="decision"
        value="deny"
        variant="outline"
        className="min-h-11 flex-1 rounded-4xl"
        disabled={pending}
        data-testid="deny-redemption"
      >
        {t('actions.deny')}
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
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
        variant="secondary"
        size="sm"
        className="min-h-11 rounded-4xl"
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

export function ApprovalQueue({
  pending,
  outstanding,
  members,
  now,
  canApprove,
}: {
  pending: RedemptionWithReward[];
  outstanding: RedemptionWithReward[];
  /**
   * The children who could be in this queue, as plain data rather than a lookup
   * *function*: this is a `'use client'` boundary, and React refuses to
   * serialise a function across it.
   */
  members: QueueMember[];
  /**
   * The instant "2 dagen geleden" is measured from, taken once on the server.
   * Without it next-intl falls back to the render clock, which differs between
   * the server render and the hydration and logs a mismatch on every load.
   */
  now: Date;
  canApprove: boolean;
}) {
  const t = useTranslations('rewards');
  const format = useFormatter();
  const memberOf = useMemberLookup(members);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <Overline>{t('queue.pendingTitle')}</Overline>

        {pending.length === 0 ? (
          <p data-testid="queue-empty" className="text-body-sm text-ink-secondary">
            {t('queue.pendingEmpty')}
          </p>
        ) : (
          <ul data-testid="approval-queue" className="flex flex-col gap-2.5">
            {pending.map((entry) => {
              const member = memberOf(entry.memberId);

              return (
                <li key={entry.id}>
                  <Card
                    data-testid="redemption-row"
                    data-redemption-id={entry.id}
                    data-status={entry.status}
                    className="gap-3 rounded-2xl p-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <MemberFace
                        size="sm"
                        name={member.displayName}
                        avatarUrl={member.avatarUrl}
                        initials={member.initials}
                        surfaceClass={member.colorClass}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-semibold">
                          {entry.rewardTitle}
                        </span>
                        <span className="block truncate text-caption text-ink-secondary">
                          {member.displayName} · {format.relativeTime(entry.requestedAt, now)}
                        </span>
                      </div>
                      <StarCount
                        value={entry.costStars}
                        srLabel={t('starsCost', { count: entry.costStars })}
                        size="sm"
                      />
                    </div>

                    {canApprove ? <DecideButtons redemptionId={entry.id} /> : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {outstanding.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <Overline>{t('queue.outstandingTitle')}</Overline>
          {/* One card, hairline dividers — never a stack of separately
              bordered row-cards. */}
          <ul
            data-testid="outstanding-queue"
            className="divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line-subtle bg-card"
          >
            {outstanding.map((entry) => {
              const member = memberOf(entry.memberId);

              return (
                <li
                  key={entry.id}
                  data-testid="redemption-row"
                  data-redemption-id={entry.id}
                  data-status={entry.status}
                  className="flex items-center gap-2.5 px-3.5 py-3"
                >
                  <MemberFace
                    size="xs"
                    name={member.displayName}
                    avatarUrl={member.avatarUrl}
                    initials={member.initials}
                    surfaceClass={member.colorClass}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">
                      {entry.rewardTitle}
                    </span>
                    {/* An approved reward that became a real appointment is no
                        longer waiting on anybody — it is *scheduled*, and the
                        line says which day rather than when it was approved
                        (`Beloningen.dc.html` r259-266). */}
                    <span className="block truncate text-caption text-ink-secondary">
                      {entry.createdEventId
                        ? t('queue.onCalendar')
                        : t('queue.approvedOn', {
                            when: entry.decidedAt
                              ? format.dateTime(entry.decidedAt, { day: 'numeric', month: 'short' })
                              : format.relativeTime(entry.requestedAt, now),
                          })}
                    </span>
                  </div>
                  {entry.createdEventId ? (
                    <Icon
                      name="event_available"
                      size="sm"
                      className="shrink-0 text-brand"
                      label={t('queue.onCalendar')}
                    />
                  ) : canApprove ? (
                    <FulfillButton redemptionId={entry.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
