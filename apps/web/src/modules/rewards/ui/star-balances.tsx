import { getTranslations } from 'next-intl/server';
import { Card, MemberFace } from '@kynite/ui';
import { MEMBER_COLOR_CLASSES, initialsOf, type Member } from '@/modules/family';
import type { StarTotals } from '../domain/economy';

/**
 * Each child's balance, on the parent's screen only
 * (`Beloningen.dc.html`, tab "Saldo").
 *
 * This is the one surface in Kynite where two children's totals appear on the
 * same screen, and it is a parent's ledger rather than a scoreboard: the cards
 * are the same size in the same order every time, there is no sorting, no
 * ranking, no delta and no "ahead of". Nothing here is reachable from a hub
 * device — `(app)` sends a paired browser to the board — which is what keeps
 * research §Decisions 3 true for the people it is about.
 *
 * Three numbers per child, and their relationship is the point: what they have
 * now is what they earned minus what they chose to spend. Earned only ever goes
 * up, because the ledger is append-only and there is no screen anywhere that
 * takes a star back.
 */
export async function StarBalances({
  members,
  totals,
}: {
  members: Member[];
  totals: Map<string, StarTotals>;
}) {
  const t = await getTranslations('rewards');

  return (
    <ul data-testid="star-balances" className="grid grid-cols-2 gap-2.5">
      {members.map((member) => {
        const total = totals.get(member.id) ?? { earned: 0, spent: 0, available: 0 };

        return (
          <li key={member.id} className="flex min-w-0">
            <Card
              data-testid="balance-card"
              data-member-id={member.id}
              className="w-full min-w-0 gap-2 rounded-2xl p-3.5"
            >
              <div className="flex items-center gap-2">
                <MemberFace
                  size="xs"
                  name={member.displayName}
                  avatarUrl={member.avatarUrl}
                  initials={initialsOf(member.displayName)}
                  surfaceClass={MEMBER_COLOR_CLASSES[member.color].surface}
                />
                <span className="min-w-0 truncate font-display text-body-sm font-bold">
                  {member.displayName}
                </span>
              </div>

              <span className="tnum font-display text-h1 font-extrabold text-gold-ink">
                {total.available}
              </span>
              {/* Wraps rather than truncates. Two cards side by side on a
                  390px phone leave 146px of text, and "62 verdiend · 34
                  uitgegeven" needs ~165 — an ellipsis here would eat the
                  second number, which is half of what the line exists to
                  say. A ledger reads on two lines; it does not read as
                  "62 verdiend · 34 uitge…". */}
              <span className="tnum text-caption leading-snug text-ink-secondary">
                {t('balance.line', { earned: total.earned, spent: total.spent })}
              </span>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
