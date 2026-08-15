'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kynite/ui';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Member } from '@/modules/family';
import { idleState } from '../action-state';
import { awardStarsAction } from '../actions';

/**
 * A parent hands out a star by hand (§7 `stars:award`).
 *
 * The reason defaults to **surprise**, and that default is the point. The
 * overjustification literature (Deci, Koestner & Ryan; research §Part 1) is
 * unambiguous: a reward the child *expected in advance* for merely engaging is
 * the one that erodes intrinsic motivation, while an unexpected one does not —
 * and can boost it. So the cheapest, most-reached-for action in this dialog is
 * the one the research endorses, and raising a routine's guaranteed payout is
 * the one that takes more clicks.
 *
 * The amount starts at 1 and cannot go below it. There is no "remove stars"
 * counterpart anywhere in this file, this slice, or the permission matrix:
 * `stars:remove` is `deny` in every column of §7 and `CHECK (amount > 0)`
 * makes it unbypassable even from a console.
 */
export function AwardStarsDialog({ members }: { members: Member[] }) {
  const t = useTranslations('rewards');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="gold" size="hub" data-testid="award-stars-trigger">
            {t('actions.awardStars')}
          </Button>
        }
      />
      <DialogContent size="hub" className="sm:max-w-md">
        {open ? <AwardForm members={members} onSaved={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AwardForm({ members, onSaved }: { members: Member[]; onSaved: () => void }) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(awardStarsAction, idleState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.status === 'idle') onSaved();
    wasPending.current = pending;
  }, [pending, state, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('award.title')}</DialogTitle>
        <DialogDescription>{t('award.description')}</DialogDescription>
      </DialogHeader>

      <Field>
        <FieldLabel>{t('award.member')}</FieldLabel>
        <Select name="memberId" defaultValue={members[0]?.id}>
          <SelectTrigger size="hub" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id} size="hub">
                {member.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>{t('award.amount')}</FieldLabel>
          <Input
            type="number"
            name="amount"
            size="hub"
            min={1}
            max={20}
            defaultValue={1}
            required
          />
        </Field>

        <Field>
          <FieldLabel>{t('award.reason')}</FieldLabel>
          {/* `surprise` first *and* default — see the note above. */}
          <Select name="reason" defaultValue="surprise">
            <SelectTrigger size="hub" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['surprise', 'bonus', 'manual'] as const).map((reason) => (
                <SelectItem key={reason} value={reason} size="hub">
                  {t(`reasons.${reason}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field>
        <FieldLabel>{t('award.note')}</FieldLabel>
        <Input name="note" size="hub" maxLength={200} autoComplete="off" />
        {/* Specific praise is the part with no downside at all (research
            §Overjustification: verbal praise shows no undermining effect), so
            the note field asks for the sentence rather than the reason code. */}
        <FieldDescription>{t('award.noteHint')}</FieldDescription>
      </Field>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose
          render={
            <Button type="button" variant="ghost" size="hub">
              {t('actions.cancel')}
            </Button>
          }
        />
        <Button type="submit" variant="gold" size="hub" disabled={pending}>
          {t('actions.award')}
        </Button>
      </DialogFooter>
    </form>
  );
}
