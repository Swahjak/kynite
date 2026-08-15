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
import { DateField } from '@/components/ui/date-field';
import { idleState } from '../action-state';
import { createMemberAction, updateMemberAction } from '../actions';
import { REWARD_HORIZONS, type Member } from '../schema';
import { AvatarPicker } from './avatar-picker';
import { ColorPicker } from './color-picker';

/** Roles a parent may hand out. `owner` is not one of them — it is the account holder. */
const ASSIGNABLE_ROLES = ['adult', 'child', 'caregiver'] as const;

export function MemberDialog({ member }: { member?: Member }) {
  const t = useTranslations('family');
  const isEdit = member !== undefined;
  const isOwner = member?.role === 'owner';

  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateMemberAction : createMemberAction,
    idleState
  );
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.status === 'idle') setOpen(false);
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? 'outline' : 'default'} size="hub">
            {isEdit ? t('actions.edit') : t('actions.add')}
          </Button>
        }
      />
      <DialogContent size="hub" className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>

          {isEdit ? <input type="hidden" name="memberId" value={member.id} /> : null}

          <Field>
            <FieldLabel>{t('form.displayName')}</FieldLabel>
            <Input
              name="displayName"
              size="hub"
              required
              maxLength={80}
              defaultValue={member?.displayName ?? ''}
              autoComplete="off"
            />
          </Field>

          <Field>
            <FieldLabel>{t('form.role')}</FieldLabel>
            {isOwner ? (
              <>
                <input type="hidden" name="role" value="owner" />
                <Input size="hub" defaultValue={t('roles.owner')} readOnly disabled />
              </>
            ) : (
              <Select name="role" defaultValue={member?.role ?? 'child'}>
                <SelectTrigger size="hub" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role} size="hub">
                      {t(`roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldDescription>{t('form.roleHint')}</FieldDescription>
          </Field>

          <ColorPicker defaultValue={member?.color ?? 'blue'} />
          <AvatarPicker defaultValue={member?.avatarUrl ?? null} />

          <Field>
            <FieldLabel>{t('form.birthDate')}</FieldLabel>
            {/* `DateField`, not `<input type="date">`: a native picker follows
                the browser's locale, not the household's `formattingLocale`
                setting (`src/i18n/formatting-locale.ts`), which no API
                overrides. Same ISO `yyyy-MM-dd` value in and out. */}
            <DateField
              name="birthDate"
              size="hub"
              defaultValue={member?.birthDate ?? ''}
              autoComplete="off"
            />
          </Field>

          <Field>
            <FieldLabel>{t('form.rewardHorizon')}</FieldLabel>
            <Select name="rewardHorizon" defaultValue={member?.rewardHorizon ?? 'instant'}>
              <SelectTrigger size="hub" className="w-full" data-testid="member-reward-horizon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWARD_HORIZONS.map((horizon) => (
                  <SelectItem key={horizon} value={horizon} size="hub">
                    {t(`rewardHorizons.${horizon}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{t('form.rewardHorizonHint')}</FieldDescription>
          </Field>

          {state.status === 'error' ? (
            <p role="alert" className="text-body-sm text-destructive">
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
            <Button type="submit" size="hub" disabled={pending} data-testid="save-member">
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
