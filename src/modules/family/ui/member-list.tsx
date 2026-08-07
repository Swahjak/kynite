import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Member } from '../schema';
import { DeleteMemberButton } from './delete-member-button';
import { MemberAvatar } from './member-avatar';
import { MemberDialog } from './member-dialog';
import { MemberInvite, type MemberInviteView } from './member-invite';

/**
 * The household roster, in board order (`sortOrder`).
 *
 * Invites live here rather than in a settings section of their own, and that
 * placement is the argument: an invite is a property of a person on this list,
 * not a separate object to go and manage. The owner adds "Papa" and the way to
 * hand Papa his login is right next to Papa's name.
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
    <ul className="flex flex-col gap-3">
      {members.map((member) => (
        <li key={member.id} data-testid="member-row" data-member-id={member.id}>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4">
              <MemberAvatar
                displayName={member.displayName}
                avatarUrl={member.avatarUrl}
                color={member.color}
                size="hub"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-base font-medium">{member.displayName}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(`roles.${member.role}`)}</Badge>
                  <Badge variant="outline">{t(`rewardHorizons.${member.rewardHorizon}`)}</Badge>
                  {member.userId === null ? <Badge variant="ghost">{t('noLogin')}</Badge> : null}
                </span>
              </div>
              <span className="flex shrink-0 flex-wrap items-center gap-2">
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
