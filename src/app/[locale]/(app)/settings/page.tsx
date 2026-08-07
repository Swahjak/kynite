import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CalendarDisplayList, loadCalendarDisplay } from '@/modules/calendar';
import {
  DeleteFamilyForm,
  FamilySettingsForm,
  HubDisplayForm,
  MemberDialog,
  MemberList,
  loadFamilyPage,
  loadFamilySettings,
} from '@/modules/family';
import { NotificationPreferencesForm, loadNotificationsPage } from '@/modules/notifications';
import { RoutineGraduationList, hasGraduated, loadRoutinesPage } from '@/modules/routines';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * The settings hub (milestone M16).
 *
 * One page with every section on it, rather than a menu of eight routes. A
 * household's settings are read far more often than they are written — "what
 * timezone are we in", "is the school calendar private", "did Bram's teeth
 * routine graduate" — and a hub that answers those without navigation is worth
 * more than a tidy index. The four surfaces that already had their own route
 * before M16 (Google, notifications, devices, share links) keep it: each is a
 * flow rather than a field, and deep links to them exist in the wild. They
 * appear here as sections with a way in.
 *
 * The members section renders the *same* `MemberList`/`MemberDialog` the
 * roster page does, bound to the same actions. It is not a second
 * implementation of member CRUD — there is exactly one, in the family slice,
 * and both surfaces mount it. That is what keeps the reward-horizon control in
 * one place: changing a child from instant to savings here is the same write
 * `(app)/family` performs, and the hub reward UI follows either way.
 *
 * Sections a caller may not use are omitted rather than disabled — the same
 * rule `loadFamilyPage` follows for invites. A control whose action would
 * refuse you is worse than no control.
 */
export default async function SettingsPage() {
  const settings = await loadFamilySettings();
  // The layout guard redirects unauthenticated requests; this is belt-and-braces.
  if (!settings) notFound();

  const [roster, routines, calendars, notifications] = await Promise.all([
    loadFamilyPage(),
    loadRoutinesPage(),
    loadCalendarDisplay(),
    loadNotificationsPage(),
  ]);

  const t = await getTranslations('settings');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {settings.canManageFamily && settings.family ? (
        <Section id="family" title={t('family.title')} description={t('family.description')}>
          <FamilySettingsForm family={settings.family} />
        </Section>
      ) : null}

      <Section id="members" title={t('members.title')} description={t('members.description')}>
        <div className="flex flex-col gap-4">
          {roster ? (
            <>
              {/* NB-7: the "new member" affordance is owner-only
                  (`member:manage`) — omitted for an adult, per this page's own
                  omit-not-disable rule, rather than shown and left to refuse. */}
              {settings.canManageMembers ? (
                <div className="flex justify-end">
                  <MemberDialog />
                </div>
              ) : null}
              <MemberList
                members={roster.members}
                invites={roster.invites}
                serverNow={roster.serverNow}
                canManage={settings.canManageMembers}
              />
            </>
          ) : null}
        </div>
      </Section>

      <Section
        id="graduation"
        title={t('graduation.title')}
        description={t('graduation.description')}
      >
        <RoutineGraduationList
          routines={
            routines
              ? routines.routines.map((routine) => ({
                  id: routine.id,
                  title: routine.title,
                  ownerName:
                    routines.members.find((member) => member.id === routine.ownerMemberId)
                      ?.displayName ?? '',
                  // The same predicate the star ledger uses, not a re-derivation:
                  // "graduated" means `rewardEnabled` off *or* `fadedAt` set, and
                  // a second opinion about that would eventually disagree.
                  graduated: hasGraduated(routine),
                }))
              : []
          }
        />
      </Section>

      <Section
        id="notifications"
        title={t('notifications.title')}
        description={t('notifications.description')}
      >
        <div className="flex flex-col gap-4">
          {notifications ? (
            <NotificationPreferencesForm preferences={notifications.preferences} />
          ) : null}
          <SectionLink href="/settings/notifications" label={t('notifications.manage')} />
        </div>
      </Section>

      <Section id="calendars" title={t('calendars.title')} description={t('calendars.description')}>
        <div className="flex flex-col gap-6">
          {settings.canManageDisplay && settings.family ? (
            <HubDisplayForm defaultView={settings.family.hubDefaultView} />
          ) : null}
          {calendars?.canManage ? (
            <CalendarDisplayList calendars={calendars.calendars} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('calendars.readOnly')}</p>
          )}
          <SectionLink href="/settings/google" label={t('calendars.manageGoogle')} />
        </div>
      </Section>

      <Section id="devices" title={t('devices.title')} description={t('devices.description')}>
        <SectionLink href="/settings/devices" label={t('devices.manage')} />
      </Section>

      <Section id="sharing" title={t('sharing.title')} description={t('sharing.description')}>
        <SectionLink href="/settings/sharing" label={t('sharing.manage')} />
      </Section>

      {settings.canManageFamily && settings.family ? (
        <Section id="danger" title={t('danger.title')} description={t('danger.description')}>
          <DeleteFamilyForm familyName={settings.family.name} />
        </Section>
      ) : null}
    </main>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-testid={`settings-section-${id}`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="font-display text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );
}
