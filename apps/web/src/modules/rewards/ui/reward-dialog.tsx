'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
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
import { Field, FieldDescription, FieldGroupLabel, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Member } from '@/modules/family';
import { cn } from '@/lib/utils';
import { idleState } from '../action-state';
import { createRewardAction, updateRewardAction } from '../actions';
import { REWARD_CATEGORIES, type Reward } from '../schema';
import { REWARD_ICONS, rewardIconOf } from './tokens';

/**
 * The parent-facing catalogue editor (M08's `(app)/rewards`).
 *
 * The category select offers three options because the database enum has three
 * (`privilege | experience | treat`). There is no "money", "allowance" or
 * "pocket money" option to remove — the omission is structural, and a test
 * asserts the enum stays that way (research §Decisions 8: paying for household
 * contribution reframes family membership as a labor transaction).
 *
 * `availableToMemberIds` defaults to empty, which means *every* child. A shelf
 * that needs per-child configuration before it works is a shelf the overloaded
 * parent never finishes setting up (research §"Mental load"), so the useful
 * default is the zero-configuration one and restriction is the deliberate act.
 */
export function RewardDialog({
  members,
  reward,
}: {
  /** The children a reward can be restricted to. */
  members: Member[];
  reward?: Reward;
}) {
  const t = useTranslations('rewards');
  const isEdit = reward !== undefined;
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? 'outline' : 'default'} size="hub">
            {isEdit ? t('actions.edit') : t('actions.add')}
          </Button>
        }
      />
      <DialogContent size="hub" className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so a cancelled edit leaves nothing behind. */}
        {open ? (
          <RewardForm members={members} reward={reward} onSaved={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RewardForm({
  members,
  reward,
  onSaved,
}: {
  members: Member[];
  reward?: Reward;
  onSaved: () => void;
}) {
  const t = useTranslations('rewards');
  const isEdit = reward !== undefined;

  const [state, formAction, pending] = useActionState(
    isEdit ? updateRewardAction : createRewardAction,
    idleState
  );
  const wasPending = useRef(false);

  const [restricted, setRestricted] = useState<string[]>(() => reward?.availableToMemberIds ?? []);

  useEffect(() => {
    if (wasPending.current && !pending && state.status === 'idle') onSaved();
    wasPending.current = pending;
  }, [pending, state, onSaved]);

  const toggle = (memberId: string) =>
    setRestricted((current) =>
      current.includes(memberId)
        ? current.filter((entry) => entry !== memberId)
        : [...current, memberId]
    );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
        <DialogDescription>{t('dialog.description')}</DialogDescription>
      </DialogHeader>

      {isEdit ? <input type="hidden" name="rewardId" value={reward.id} /> : null}
      <input type="hidden" name="active" value="on" />
      {restricted.map((memberId) => (
        <input key={memberId} type="hidden" name="availableToMemberIds" value={memberId} />
      ))}

      <Field>
        <FieldLabel>{t('form.title')}</FieldLabel>
        <Input
          name="title"
          size="hub"
          required
          maxLength={120}
          defaultValue={reward?.title ?? ''}
          autoComplete="off"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>{t('form.category')}</FieldLabel>
          <Select name="category" defaultValue={reward?.category ?? 'privilege'}>
            <SelectTrigger size="hub" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REWARD_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category} size="hub">
                  {t(`categories.${category}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{t('form.categoryHint')}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>{t('form.costStars')}</FieldLabel>
          <Input
            type="number"
            name="costStars"
            size="hub"
            min={1}
            max={500}
            required
            defaultValue={reward?.costStars ?? 5}
          />
          <FieldDescription>{t('form.costStarsHint')}</FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel>{t('form.icon')}</FieldLabel>
        <Select name="icon" defaultValue={rewardIconOf(reward?.icon ?? null)}>
          <SelectTrigger size="hub" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REWARD_ICONS.map((icon) => (
              <SelectItem key={icon} value={icon} size="hub">
                {t(`icons.${icon}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {members.length > 0 ? (
        <div className="flex w-full flex-col gap-1.5">
          <FieldGroupLabel>{t('form.availableTo')}</FieldGroupLabel>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('form.availableTo')}>
            {members.map((member) => {
              const selected = restricted.includes(member.id);
              return (
                <label
                  key={member.id}
                  data-testid={`reward-member-${member.id}`}
                  data-selected={selected ? 'true' : 'false'}
                  className={cn(
                    'flex h-12 min-w-12 cursor-pointer items-center justify-center rounded-xl px-4 font-display text-sm font-medium transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(member.id)}
                    className="sr-only"
                  />
                  {member.displayName}
                </label>
              );
            })}
          </div>
          <FieldDescription>{t('form.availableToHint')}</FieldDescription>
        </div>
      ) : null}

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
        <Button type="submit" size="hub" disabled={pending}>
          {t('actions.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
