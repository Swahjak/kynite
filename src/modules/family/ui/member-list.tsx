import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Member } from '../schema';
import { DeleteMemberButton } from './delete-member-button';
import { MemberAvatar } from './member-avatar';
import { MemberDialog } from './member-dialog';

/** The household roster, in board order (`sortOrder`). */
export async function MemberList({ members }: { members: Member[] }) {
  const t = await getTranslations('family');

  return (
    <ul className="flex flex-col gap-3">
      {members.map((member) => (
        <li key={member.id}>
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
              <span className="flex shrink-0 items-center gap-2">
                <MemberDialog member={member} />
                {member.role === 'owner' ? null : (
                  <DeleteMemberButton memberId={member.id} displayName={member.displayName} />
                )}
              </span>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
