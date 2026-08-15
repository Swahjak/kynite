'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cn, Icon, Input, MemberChip, Overline, StarStepper } from '@kynite/ui';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { idleState } from '../action-state';
import { awardStarsAction } from '../actions';
import type { QueueMember } from './approval-queue';

/**
 * A parent hands out a star by hand (§7 `stars:award`) — `Beloningen.dc.html`,
 * "sterren geven".
 *
 * A bottom sheet rather than a dialog, because that is what the sheets draw and
 * what the action is: a thing done in ten seconds with one thumb while standing
 * in a kitchen.
 *
 * The reason defaults to **surprise**, and that default is the point. The
 * overjustification literature (Deci, Koestner & Ryan; research §Part 1) is
 * unambiguous: a reward the child *expected in advance* for merely engaging is
 * the one that erodes intrinsic motivation, while an unexpected one does not —
 * and can boost it. So the cheapest, most-reached-for option in this sheet is
 * the one the research endorses, and raising a routine's guaranteed payout is
 * the one that takes more taps.
 *
 * The stepper starts at 1 and stops at 1. There is no "remove stars"
 * counterpart anywhere in this file, this slice, or the permission matrix:
 * `stars:remove` is `deny` in every column of §7 and `CHECK (amount > 0)`
 * makes it unbypassable even from a console.
 *
 * `members` arrives as faces already resolved to plain strings by the page.
 * Importing `@/modules/family` from a `'use client'` module pulls the family
 * barrel — and with it `principal.ts` and `next/headers` — into the browser
 * bundle, which does not merely bloat it: it fails to compile.
 */
export function AwardStarsDialog({ members }: { members: QueueMember[] }) {
  const t = useTranslations('rewards');
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm" className="rounded-4xl" data-testid="award-stars-trigger">
            <Icon name="star" size="sm" />
            {t('actions.awardStars')}
          </Button>
        }
      />
      {/* No corner ✕: the grabber above the title is the affordance the sheet
          draws, and a second dismiss control in the corner competes with the
          one thumb this is designed for. The scrim goes to the design system's
          35% so the sheet owns the screen. */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        overlayClassName="bg-scrim/35"
        className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-[28px] px-5 pt-2.5 pb-7"
      >
        {open ? <AwardForm members={members} onSaved={() => setOpen(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

/** The two reasons a parent picks between. `manual` stays available to the API. */
const REASONS = ['surprise', 'bonus'] as const;

function AwardForm({ members, onSaved }: { members: QueueMember[]; onSaved: () => void }) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(awardStarsAction, idleState);
  const wasPending = useRef(false);

  const [memberId, setMemberId] = useState(() => members[0]?.id ?? '');
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('surprise');

  useEffect(() => {
    if (wasPending.current && !pending && state.status === 'idle') onSaved();
    wasPending.current = pending;
  }, [pending, state, onSaved]);

  const recipient = members.find((member) => member.id === memberId);

  return (
    <form action={formAction} className="flex flex-col">
      <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line" />

      <SheetTitle className="font-display text-h2 font-extrabold text-ink">
        {t('award.title')}
      </SheetTitle>
      <SheetDescription className="mb-4.5 text-caption text-ink-secondary">
        {t('award.description')}
      </SheetDescription>

      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="reason" value={reason} />

      <Overline className="mb-2">{t('award.member')}</Overline>
      <div role="radiogroup" aria-label={t('award.member')} className="mb-4.5 flex flex-wrap gap-2">
        {members.map((member) => {
          const selected = member.id === memberId;
          return (
            <label key={member.id} className="cursor-pointer">
              <input
                type="radio"
                name="memberChoice"
                value={member.id}
                checked={selected}
                onChange={() => setMemberId(member.id)}
                className="sr-only"
              />
              <MemberChip
                name={member.displayName}
                avatarUrl={member.avatarUrl}
                initials={member.initials}
                surfaceClass={member.colorClass}
                selected={selected}
                data-testid={`award-member-${member.id}`}
              />
            </label>
          );
        })}
      </div>

      <Overline className="mb-2">{t('award.amount')}</Overline>
      {/* A white card with the control centred in it (`Beloningen.dc.html`
          r344-348) — the number is the thing being decided, so it sits in the
          middle of its own surface rather than left-aligned against a label. */}
      <div className="mb-4.5 rounded-2xl border border-line-subtle bg-card p-3.5">
        {/* The stepper stops at one and has no subtract mode: there is no
            screen in Kynite that takes a star back. */}
        <StarStepper
          name="amount"
          size="lg"
          showStar
          min={1}
          max={20}
          value={amount}
          onValueChange={setAmount}
          copy={{
            decrease: t('award.fewer'),
            increase: t('award.more'),
            value: t('starsCost', { count: amount }),
          }}
        />
      </div>

      <Overline className="mb-2">{t('award.reason')}</Overline>
      <div role="radiogroup" aria-label={t('award.reason')} className="mb-3 flex gap-2">
        {REASONS.map((option) => {
          const selected = option === reason;
          return (
            <label
              key={option}
              data-testid={`award-reason-${option}`}
              className={cn(
                // 10px of vertical padding, not 14: two words in a pill next
                // to a 44px stepper is a chip, and the sheet's own rhythm
                // (r354-357) keeps it under the amount card rather than
                // matching it.
                'flex-1 cursor-pointer rounded-4xl py-2 text-center font-display text-body-sm font-bold transition-colors',
                selected
                  ? 'border-2 border-primary bg-accent text-ink'
                  : 'border border-line-subtle bg-card text-ink-secondary'
              )}
            >
              <input
                type="radio"
                name="reasonChoice"
                value={option}
                checked={selected}
                onChange={() => setReason(option)}
                className="sr-only"
              />
              {t(`reasons.${option}`)}
            </label>
          );
        })}
      </div>

      {/* Specific praise is the part with no downside at all (research
          §Overjustification: verbal praise shows no undermining effect), so the
          note asks for the sentence rather than for a category. */}
      <Input
        name="note"
        maxLength={200}
        autoComplete="off"
        aria-label={t('award.note')}
        placeholder={t('award.noteHint')}
        className="mb-4.5"
      />

      {state.status === 'error' ? (
        <p role="alert" className="mb-3 text-body-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <Button type="submit" className="min-h-13 w-full rounded-4xl text-body" disabled={pending}>
        {recipient
          ? t('award.submitNamed', { count: amount, name: recipient.displayName })
          : t('actions.award')}
      </Button>
    </form>
  );
}
