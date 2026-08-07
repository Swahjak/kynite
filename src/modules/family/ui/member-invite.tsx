'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createInviteIdle, type CreateInviteState } from '../action-state';
import { createInviteAction, revokeInviteAction } from '../actions';
import { inviteStateOf, type InviteState } from '../domain/invite';

/**
 * The owner's half of the second-parent flow: mint one link, watch it, kill it.
 *
 * This is where all the typing in FR26 happens, and it happens on the *owner's*
 * phone: one email address, once, for a person whose name and role they already
 * entered when they added them to the roster. Everything the invitee would
 * otherwise have been asked for is derived from that row, which is the trade
 * the whole milestone rests on — the admin does thirty seconds more work so the
 * second parent does none.
 *
 * The link is shown exactly once, after minting. Nothing stores the raw token,
 * so an owner who loses it revokes and mints again — same bargain as a
 * caregiver share link and the six-digit pairing code before it.
 */
export type MemberInviteView = {
  id: string;
  email: string;
  expiresAt: number;
  claimedAt: number | null;
  revokedAt: number | null;
};

export function MemberInvite({
  memberId,
  displayName,
  invite,
  serverNow,
}: {
  memberId: string;
  displayName: string;
  invite: MemberInviteView | null;
  serverNow: number;
}) {
  const t = useTranslations('family.invite.manage');
  const tErrors = useTranslations('family.errors');
  const format = useFormatter();

  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CreateInviteState>(createInviteIdle);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const state: InviteState | null = invite
    ? inviteStateOf(
        {
          claimedAt: invite.claimedAt === null ? null : new Date(invite.claimedAt),
          revokedAt: invite.revokedAt === null ? null : new Date(invite.revokedAt),
          expiresAt: new Date(invite.expiresAt),
        },
        new Date(serverNow)
      )
    : null;

  const create = (formData: FormData) => {
    const email = formData.get('email');
    if (typeof email !== 'string') return;

    setError(null);
    startTransition(async () => {
      const created = await createInviteAction({ memberId, email });
      setResult(created);
      if (created.status === 'error') setError(created.error);
    });
  };

  const revoke = () => {
    if (!invite) return;
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const revoked = await revokeInviteAction({ inviteId: invite.id });
      if (revoked.status === 'error') setError(revoked.error);
    });
  };

  /**
   * A live link already exists: the only thing left to offer is taking it back.
   *
   * `result.status !== 'created'` guards it, and that clause is load-bearing.
   * Minting revalidates the roster, which re-renders this component with an
   * invite that is now `pending` — so without the guard the dialog holding the
   * one and only copy of the link would be swapped out for a badge in the same
   * commit that produced it, and the owner would never see what they just made.
   * The freshly minted link outranks the server's view until it is dismissed.
   */
  if (result.status !== 'created' && state === 'pending') {
    return (
      <span className="flex flex-wrap items-center gap-2" data-testid="member-invite-pending">
        <Badge variant="secondary">
          {t('pendingUntil', { date: format.dateTime(new Date(invite!.expiresAt)) })}
        </Badge>
        {error ? (
          <span role="alert" className="text-body-sm text-destructive">
            {tErrors(error)}
          </span>
        ) : null}
        {confirming ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={revoke}
            data-testid="member-invite-revoke-confirm"
          >
            {t('revokeConfirm')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
            data-testid="member-invite-revoke"
          >
            {t('revoke')}
          </Button>
        )}
      </span>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The token is gone the moment the dialog closes — it exists only in
        // this component's state and in the invitee's URL bar.
        if (!next) {
          setResult(createInviteIdle);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="hub" data-testid="member-invite-open">
            {t('open')}
          </Button>
        }
      />
      <DialogContent size="hub" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title', { name: displayName })}</DialogTitle>
          <DialogDescription>{t('description', { name: displayName })}</DialogDescription>
        </DialogHeader>

        {result.status === 'created' ? (
          <Field>
            <FieldLabel>{t('linkLabel')}</FieldLabel>
            {/*
              Read-only and selectable rather than a copy button alone: the owner
              is going to paste this into WhatsApp, and a value they can see is a
              value they can check before they send it to the wrong chat.
            */}
            <Input
              readOnly
              value={result.url}
              size="hub"
              onFocus={(event) => event.currentTarget.select()}
              data-testid="member-invite-url"
            />
            <FieldDescription>
              {t('expires', { date: format.dateTime(new Date(result.expiresAt)) })}
            </FieldDescription>
          </Field>
        ) : (
          <form action={create} className="flex flex-col gap-4">
            <Field>
              <FieldLabel>{t('emailLabel')}</FieldLabel>
              <Input
                name="email"
                type="email"
                size="hub"
                required
                autoComplete="off"
                data-testid="member-invite-email"
              />
              <FieldDescription>{t('emailHint')}</FieldDescription>
            </Field>

            {error ? (
              <p role="alert" className="text-body-sm text-destructive">
                {tErrors(error)}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="submit" size="hub" disabled={pending} data-testid="member-invite-send">
                {t('submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
