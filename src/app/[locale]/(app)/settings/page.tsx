import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  SettingsNavRow,
  SettingsPage,
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/settings-shell';
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
 * The settings hub (milestone M16, restyled in M19 phase 2).
 *
 * One page with every section on it, rather than a menu of eight routes. A
 * household's settings are read far more often than they are written — "what
 * timezone are we in", "is the school calendar private", "did Bram's teeth
 * routine graduate" — and a hub that answers those without navigation is worth
 * more than a tidy index. The four surfaces that already had their own route
 * before M16 (Google, notifications, devices, share links) keep it: each is a
 * flow rather than a field, and deep links to them exist in the wild. They
 * appear here as icon-led rows with a chevron, which is the mockups' idiom for
 * "this continues elsewhere" and the only affordance on the page that navigates.
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
export default async function SettingsHubPage() {
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
    <SettingsPage>
      <SettingsPageHeader icon="settings" title={t('title')} description={t('subtitle')} />

      {settings.canManageFamily && settings.family ? (
        <SettingsSection
          id="family"
          title={t('family.title')}
          description={t('family.description')}
        >
          <FamilySettingsForm family={settings.family} />
        </SettingsSection>
      ) : null}

      <SettingsSection
        id="members"
        title={t('members.title')}
        description={t('members.description')}
        // NB-7: the "new member" affordance is owner-only (`member:manage`) —
        // omitted for an adult, per this page's own omit-not-disable rule,
        // rather than shown and left to refuse.
        action={roster && settings.canManageMembers ? <MemberDialog /> : undefined}
      >
        {roster ? (
          <MemberList
            members={roster.members}
            invites={roster.invites}
            serverNow={roster.serverNow}
            canManage={settings.canManageMembers}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection
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
      </SettingsSection>

      <SettingsSection
        id="notifications"
        title={t('notifications.title')}
        description={t('notifications.description')}
      >
        {notifications ? (
          <NotificationPreferencesForm preferences={notifications.preferences} />
        ) : null}
        <SettingsNavRow
          href="/settings/notifications"
          icon="notifications"
          label={t('notifications.manage')}
          bordered
        />
      </SettingsSection>

      <SettingsSection
        id="calendars"
        title={t('calendars.title')}
        description={t('calendars.description')}
      >
        {settings.canManageDisplay && settings.family ? (
          <HubDisplayForm defaultView={settings.family.hubDefaultView} />
        ) : null}
        {calendars?.canManage ? (
          <CalendarDisplayList calendars={calendars.calendars} />
        ) : (
          <p className="text-body-sm text-ink-secondary">{t('calendars.readOnly')}</p>
        )}
        <SettingsNavRow
          href="/settings/google"
          icon="calendar_month"
          label={t('calendars.manageGoogle')}
          bordered
        />
      </SettingsSection>

      <SettingsSection id="devices" title={t('devices.title')}>
        <SettingsNavRow
          href="/settings/devices"
          icon="tablet_mac"
          label={t('devices.manage')}
          description={t('devices.description')}
        />
      </SettingsSection>

      <SettingsSection id="sharing" title={t('sharing.title')}>
        <SettingsNavRow
          href="/settings/sharing"
          icon="share"
          label={t('sharing.manage')}
          description={t('sharing.description')}
        />
      </SettingsSection>

      {settings.canManageFamily && settings.family ? (
        <SettingsSection
          id="danger"
          title={t('danger.title')}
          description={t('danger.description')}
          tone="danger"
        >
          <DeleteFamilyForm familyName={settings.family.name} />
        </SettingsSection>
      ) : null}
    </SettingsPage>
  );
}
