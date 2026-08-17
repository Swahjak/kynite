'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, cn, Icon } from '@kynite/ui';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { HUB_THEME_MODES, type HubThemeMode, type ResolvedHubTheme } from './hub-theme';

/** The route handler `unpair()` below calls — see its own doc comment. */
const UNPAIR_ENDPOINT = '/api/devices/session/unpair';

/**
 * The kiosk's settings corner (M12).
 *
 * M09 put the chime intensity and a volume slider directly on the ambient
 * board, and the M09 review called it what it was: furniture. A wall display's
 * job is to be looked at from across the room, and a control nobody touches
 * more than twice a year was occupying permanent space on it — worse, at
 * child height, on a surface children stand in front of.
 *
 * So it moves behind one discreet icon in the corner, alongside the only other
 * settings a *device* is allowed to have: which theme this particular screen
 * runs. Everything else about a family is configured from the parent app,
 * because the §7 matrix gives a device principal no write beyond completions,
 * timers and redemption requests — there is deliberately nothing else to put
 * in here.
 */
export function HubSettings({
  deviceName,
  mode,
  theme,
  onModeChange,
  chimeSettings,
}: {
  deviceName: string;
  mode: HubThemeMode;
  theme: ResolvedHubTheme;
  onModeChange: (next: HubThemeMode) => void;
  /**
   * The timers slice's chime control, rendered by the hub *layout* and handed
   * down as a node. It cannot be imported here: this is a client component, and
   * `@/modules/timers` re-exports `server-only` queries that would pull `pg`
   * into the browser bundle (see `modules/timers/ui/chime-settings-panel.tsx`).
   */
  chimeSettings?: React.ReactNode;
}) {
  const t = useTranslations('devices.hubSettings');
  const locale = useLocale();
  // BLOCKING 2: the only way off this screen for a browser that was paired by
  // mistake — see `src/app/api/devices/session/unpair/route.ts` for why this
  // needs no `assertCan` gymnastics. Two taps: the trigger reveals a confirm
  // step rather than acting immediately, because this is destructive to
  // whatever the wall is currently showing.
  const [confirmingUnpair, setConfirmingUnpair] = useState(false);
  const [unpairing, startUnpair] = useTransition();
  const [unpairError, setUnpairError] = useState(false);

  const unpair = () => {
    setUnpairError(false);
    startUnpair(async () => {
      try {
        const response = await fetch(UNPAIR_ENDPOINT, { method: 'POST', cache: 'no-store' });
        if (!response.ok) {
          setUnpairError(true);
          return;
        }
        // A hard navigation, not `router.refresh()`: the cookie the response
        // just cleared has to actually be gone from the next request, and
        // this is the parent app's root, not a hub route — there is nothing
        // for the hub's own client tree to keep alive across the jump.
        window.location.href = new URL(`/${locale}`, window.location.origin).toString();
      } catch {
        setUnpairError(true);
      }
    });
  };

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-hub"
            aria-label={t('open')}
            data-testid="hub-settings-trigger"
          >
            <Icon name="settings" size="lg" />
          </Button>
        }
      />
      <SheetContent
        side="right"
        size="hub"
        className="flex flex-col gap-8 overflow-y-auto p-6"
        data-testid="hub-settings"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="font-display text-h2">{t('title')}</SheetTitle>
          <SheetDescription className="text-body">
            {t('deviceName', { name: deviceName })}
          </SheetDescription>
        </SheetHeader>

        <section className="flex flex-col gap-3">
          <h3 className="font-display text-h3 font-semibold">{t('theme.title')}</h3>
          <div role="group" aria-label={t('theme.title')} className="flex flex-wrap gap-2">
            {HUB_THEME_MODES.map((option) => (
              <Button
                key={option}
                type="button"
                size="hub"
                variant={mode === option ? 'default' : 'outline'}
                aria-pressed={mode === option}
                onClick={() => onModeChange(option)}
                data-testid={`hub-theme-${option}`}
              >
                <Icon
                  name={
                    option === 'dark' ? 'dark_mode' : option === 'light' ? 'light_mode' : 'schedule'
                  }
                  size="md"
                  inline="start"
                />
                {t(`theme.${option}`)}
              </Button>
            ))}
          </div>
          <p className={cn('text-body-sm text-ink-secondary')} data-testid="hub-theme-resolved">
            {t(`theme.active.${theme}`)}
          </p>
        </section>

        {chimeSettings}

        <section className="mt-auto flex flex-col gap-3 border-t border-border pt-6">
          {confirmingUnpair ? (
            // Deliberately no alarm styling: `src/components/hub` is a
            // child-facing tree (`tests/unit/no-negative-marking.test.ts`
            // scans it), and this sheet is reachable by anyone standing at
            // the wall, not only a parent. "Neutral copy, neutral styling" is
            // the same rule the pairing screen already follows for a wrong
            // code — a fact about what tapping this does, not an alarm.
            <div
              // Nested in the sheet panel: the tonal fill is the separation.
              className="flex flex-col gap-3 rounded-xl bg-muted p-4"
              data-testid="hub-unpair-confirm"
            >
              <p className="text-body-sm text-foreground">{t('unpair.confirmBody')}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="hub"
                  onClick={unpair}
                  disabled={unpairing}
                  data-testid="hub-unpair-confirm-yes"
                >
                  <Icon name="delete" size="md" inline="start" />
                  {t('unpair.confirm')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="hub"
                  onClick={() => setConfirmingUnpair(false)}
                  disabled={unpairing}
                  data-testid="hub-unpair-cancel"
                >
                  {t('unpair.cancel')}
                </Button>
              </div>
              {unpairError ? (
                <p role="status" aria-live="polite" className="text-body-sm text-ink-secondary">
                  {t('unpair.error')}
                </p>
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="hub"
              className="justify-start text-ink-secondary"
              onClick={() => setConfirmingUnpair(true)}
              data-testid="hub-unpair-trigger"
            >
              <Icon name="delete" size="md" inline="start" />
              {t('unpair.trigger')}
            </Button>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
