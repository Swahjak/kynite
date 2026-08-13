import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { canOwn, type Principal } from '@/modules/family';
import { listReauthRequiredAccounts } from '../queries';

/**
 * `invalid_grant` surfaced (M05 acceptance criterion, docs/architecture.md §5).
 *
 * A dead refresh token means the calendar has silently stopped syncing, which
 * is exactly the failure a family will not notice on their own — so it is
 * rendered in the app shell, on every page, until someone links again. A
 * server component: it is one indexed read and it must never be stale.
 *
 * Gated on `google:link` (same capability the settings page and its actions
 * use, docs/architecture.md §7): a caregiver/viewer principal can be signed
 * in but has no business seeing which Google accounts are linked, so the
 * banner — and the read behind it — is skipped entirely rather than shown
 * and then hidden client-side.
 */
export async function GoogleReauthBanner({ principal }: { principal: Principal }) {
  if (!canOwn(principal, 'google:link')) return null;

  const accounts = await listReauthRequiredAccounts(principal.familyId);
  if (accounts.length === 0) return null;

  const t = await getTranslations('google');

  return (
    <div
      role="alert"
      data-slot="google-reauth-banner"
      className="flex flex-wrap items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-body-sm text-destructive sm:px-6"
    >
      <Icon name="calendar_month" size="sm" className="shrink-0" />
      <span className="min-w-0 flex-1">
        {t('reauthBanner', { email: accounts.map((a) => a.email).join(', ') })}
      </span>
      <Button
        render={<Link href="/settings/google" />}
        nativeButton={false}
        variant="destructive-soft"
        size="sm"
      >
        {t('reauthAction')}
      </Button>
    </div>
  );
}
