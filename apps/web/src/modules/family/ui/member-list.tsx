import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardContent, cn } from '@kynite/ui';
import type { Member } from '../schema';
import { DeleteMemberButton } from './delete-member-button';
import { MemberAvatar } from './member-avatar';
import { MemberDialog } from './member-dialog';
import { MemberInvite, type MemberInviteView } from './member-invite';
import { MEMBER_COLOR_CLASSES } from './tokens';

/**
 * The household roster, in board order (`sortOrder`).
 *
 * Invites live here rather than in a settings section of their own, and that
 * placement is the argument: an invite is a property of a person on this list,
 * not a separate object to go and manage. The owner adds "Papa" and the way to
 * hand Papa his login is right next to Papa's name.
 *
 * M19 phase 2 makes each row a card in the member's own colour — a full-bleed
 * accent bar across the top and a ring around the face. Colour is the identity
 * system this whole product runs on (person columns, event chips, star charts),
 * and the roster was the one surface that rendered a member without ever
 * showing which colour they *are*. Two per row from `sm` up: at 390px a card
 * with an avatar, two badges and three actions has no room to share.
 */
export async function MemberList({
  members,
  invites,
  serverNow,
  canManage = true,
}: {
  members: Member[];
  /** Latest invite per member id — `{}` for anyone without `member:manage`. */
  invites: Record<string, MemberInviteView>;
  /** Captured in `loadFamilyPage`, not read here: the clock is impure. */
  serverNow: number;
  /**
   * `member:manage` — gates the edit/invite/delete affordances (NB-7).
   * Defaults `true` so `(app)/family` (owner-and-adult-reachable, but where
   * the write actions themselves already refuse an adult) keeps its current
   * shape; the settings hub is the caller that passes the real answer.
   */
  canManage?: boolean;
}) {
  const t = await getTranslations('family');

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {members.map((member) => (
        <li key={member.id} data-testid="member-row" data-member-id={member.id}>
          <Card className="h-full">
            {/* The member's colour, full-bleed: `Card` pads vertically with
                `--card-spacing`, so the bar has to climb back out of it. */}
            <span
              aria-hidden
              className={cn(
                '-mt-(--card-spacing) h-1.5 w-full',
                MEMBER_COLOR_CLASSES[member.color].dot
              )}
            />
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <MemberAvatar
                  displayName={member.displayName}
                  avatarUrl={member.avatarUrl}
                  color={member.color}
                  size="hub"
                  ringed
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {/* Wrapped, not truncated: a member's name is the one string
                      on this card that must survive being long, and "Alexandr…"
                      is a card that has lost the thing it is for. Two lines is
                      the ceiling, so a pathological name cannot push the badges
                      and the actions out of the grid. */}
                  <span className="line-clamp-2 font-display text-h3 font-semibold text-ink">
                    {member.displayName}
                  </span>
                  <span className="text-body-sm text-ink-secondary">
                    {t(`roles.${member.role}`)}
                  </span>
                </div>
              </div>

              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(`rewardHorizons.${member.rewardHorizon}`)}</Badge>
                {member.userId === null ? <Badge variant="ghost">{t('noLogin')}</Badge> : null}
              </span>

              {/* `empty:hidden` — a viewer without `member:manage` gets no
                  actions at all, and an empty row still costs a `gap`. */}
              <span className="flex flex-wrap items-center gap-2 empty:hidden">
                {/*
                  Only an adult with no login can be invited: the owner is the
                  person sending it, a child never logs in (§3), and a caregiver
                  reaches the household through a share link with no account.
                  The same predicate is enforced in `mintInvite`; this just
                  keeps the button from appearing where it would only fail.
                */}
                {canManage && member.role === 'adult' && member.userId === null ? (
                  <MemberInvite
                    memberId={member.id}
                    displayName={member.displayName}
                    invite={invites[member.id] ?? null}
                    serverNow={serverNow}
                  />
                ) : null}
                {/* NB-7: omitted rather than disabled for a caller without
                    `member:manage` — a button whose action would only refuse
                    is worse than no button. */}
                {canManage ? <MemberDialog member={member} /> : null}
                {canManage && member.role !== 'owner' ? (
                  <DeleteMemberButton memberId={member.id} displayName={member.displayName} />
                ) : null}
              </span>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
