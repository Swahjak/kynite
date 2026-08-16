'use client';

import { useActionState, useId, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Field,
  FieldGroupLabel,
  FieldLabel,
  Input,
  useSubmitGuard,
} from '@kynite/ui';
import { idleState, type ActionState, type AddSubscriptionState } from '../action-state';
import {
  addSubscriptionAction,
  refreshSubscriptionAction,
  removeSubscriptionAction,
  setSubscriptionEnabledAction,
} from '../actions';
import { FEED_COLORS, type FeedColor } from '../domain/color';
import { FEED_PRESETS, findPreset, type FeedPreset } from '../domain/presets';
import type { SubscriptionView } from '../queries';

/**
 * The subscription surface (M25) — `(app)/settings/subscriptions`.
 *
 * Three things happen here and nothing else: paste a link, see whether it is
 * still working, and stop. Everything *about* a subscribed calendar that is
 * shared with a Google one — its visibility, its default event type, its place
 * in the calendar list — is already configured in the calendars section of the
 * settings hub, because to that section a feed is simply another calendar.
 *
 * The removal confirmation is an `AlertDialog` for the same reason the Google
 * panel's is: it destroys an amount of data a parent cannot see from the
 * button, so the dialog exists to *state the number* before it is agreed to.
 */

/**
 * The eight palette dots, written out rather than imported from
 * `modules/calendar/ui/tokens.ts`: a client component may not deep-import
 * another slice (§2), and Tailwind needs the literal class names anyway. The
 * `FeedColor` key type is what keeps the two in step — a ninth category in the
 * palette is a type error here.
 */
const COLOR_DOT: Record<FeedColor, string> = {
  blue: 'bg-cat-blue-solid',
  purple: 'bg-cat-purple-solid',
  orange: 'bg-cat-orange-solid',
  green: 'bg-cat-green-solid',
  red: 'bg-cat-red-solid',
  yellow: 'bg-cat-yellow-solid',
  pink: 'bg-cat-pink-solid',
  teal: 'bg-cat-teal-solid',
};

export type IcsSubscriptionsPanelProps = {
  subscriptions: SubscriptionView[];
  canManage: boolean;
};

export function IcsSubscriptionsPanel({ subscriptions, canManage }: IcsSubscriptionsPanelProps) {
  const t = useTranslations('ics');

  return (
    <div className="flex flex-col gap-4">
      {canManage ? <AddSubscriptionCard /> : null}

      {subscriptions.length === 0 ? (
        <p className="px-1 text-body-sm text-ink-secondary">{t('empty')}</p>
      ) : (
        subscriptions.map((subscription) => (
          <SubscriptionCard
            key={subscription.id}
            subscription={subscription}
            canManage={canManage}
          />
        ))
      )}
    </div>
  );
}

/**
 * The guided half: pick the platform, read where its link is hiding, paste.
 *
 * The picker is the feature. Every URL below is vendor-documented and every one
 * of them is behind a click path a parent will not find — Social Schools only
 * reveals it in the **web** app, Zermelo refuses to make one for a parent
 * account, Somtoday's school can switch it off. So the steps are not decoration
 * around the field; they are the reason the field can be filled in at all.
 *
 * Deliberately not a wizard. The picker sits above the same three controls that
 * were already here, so "I already have the link" stays one paste and one
 * button, and choosing a platform only *adds* instructions and a shape check.
 */
function PresetPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useTranslations('ics');
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <FieldGroupLabel id={labelId}>{t('presets.title')}</FieldGroupLabel>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {FEED_PRESETS.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={value === preset.key}
            onClick={() => onChange(value === preset.key ? '' : preset.key)}
            data-testid={`preset-${preset.key}`}
            className={cn(value === preset.key && 'border-ring ring-3 ring-ring/50')}
          >
            {t(`presets.${preset.key}.label` as 'presets.parro.label')}
            {preset.level === 'vo' ? (
              <Badge variant="outline" className="ml-1.5">
                {t('presets.voBadge')}
              </Badge>
            ) : null}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PresetInstructions({ preset }: { preset: FeedPreset }) {
  const t = useTranslations('ics');
  const key = preset.key as 'parro';

  return (
    <div
      className="flex flex-col gap-2 rounded-xl bg-surface-container px-4 py-3"
      data-testid="preset-instructions"
    >
      <ol className="flex list-decimal flex-col gap-1 pl-4 text-body-sm text-ink-secondary">
        <li>{t(`presets.${key}.step1`)}</li>
        <li>{t(`presets.${key}.step2`)}</li>
        <li>{t(`presets.${key}.step3`)}</li>
      </ol>
      <p className="text-caption text-ink-muted">{t(`presets.${key}.note`)}</p>
      {preset.helpUrl ? (
        <a
          href={preset.helpUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-caption text-brand underline underline-offset-2 self-start"
        >
          {t('presets.help')}
        </a>
      ) : null}
    </div>
  );
}

function AddSubscriptionCard() {
  const t = useTranslations('ics');
  const [state, action, pending] = useActionState<AddSubscriptionState, FormData>(
    addSubscriptionAction,
    idleState
  );
  const { locked, lock } = useSubmitGuard(pending);
  const [color, setColor] = useState<FeedColor>('blue');
  const [presetId, setPresetId] = useState('');
  const colorLabelId = useId();
  const preset = findPreset(presetId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('add.title')}</CardTitle>
        <CardDescription>{t('add.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} onSubmit={lock} className="flex flex-col gap-4">
          <input type="hidden" name="presetId" value={presetId} />
          <PresetPicker value={presetId} onChange={setPresetId} />
          {preset ? <PresetInstructions preset={preset} /> : null}

          <Field>
            <FieldLabel>{t('add.url')}</FieldLabel>
            {/* `type="url"` would refuse `webcal://` in some browsers before the
                server ever sees it — and that is the scheme a school's website
                actually links. The value is validated server-side regardless
                (`domain/url.ts`), which is the only place it can be. */}
            <Input
              name="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              required
              placeholder={t('add.urlPlaceholder')}
              data-testid="subscription-url"
            />
          </Field>

          <Field>
            <FieldLabel>{t('add.name')}</FieldLabel>
            <Input
              name="name"
              autoComplete="off"
              maxLength={120}
              placeholder={t('add.namePlaceholder')}
              data-testid="subscription-name"
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <FieldGroupLabel id={colorLabelId}>{t('add.color')}</FieldGroupLabel>
            <input type="hidden" name="color" value={color} />
            <div role="group" aria-labelledby={colorLabelId} className="flex flex-wrap gap-2">
              {FEED_COLORS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  size="icon-hub"
                  aria-pressed={color === option}
                  aria-label={t(`colors.${option}` as 'colors.blue')}
                  onClick={() => setColor(option)}
                  className={cn(color === option && 'border-ring ring-3 ring-ring/50')}
                >
                  <span aria-hidden className={cn('size-6 rounded-full', COLOR_DOT[option])} />
                </Button>
              ))}
            </div>
          </div>

          {state.status === 'error' ? (
            <p role="alert" className="text-body-sm text-destructive">
              {t(`errors.${state.error}` as 'errors.forbidden')}
            </p>
          ) : null}

          {/* Added, and worth a sentence anyway. An empty feed answers 200 with
              a valid calendar containing nothing, so silence here would be a
              green tick over an agenda that will never show a single day. */}
          {state.status === 'added' && state.warnings.length > 0 ? (
            <div
              role="status"
              className="flex flex-col gap-1 rounded-xl bg-warning/10 px-4 py-3 text-body-sm text-ink"
              data-testid="subscription-warning"
            >
              {state.warnings.map((warning) => (
                <p key={warning}>{t(`add.warnings.${warning}` as 'add.warnings.emptyFeed')}</p>
              ))}
            </div>
          ) : null}

          {state.status === 'added' && state.warnings.length === 0 ? (
            <p role="status" className="text-body-sm text-ink-secondary">
              {t('add.added')}
            </p>
          ) : null}

          <Button type="submit" size="hub" disabled={locked} className="self-start">
            {pending ? t('add.pending') : t('add.action')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({
  subscription,
  canManage,
}: {
  subscription: SubscriptionView;
  canManage: boolean;
}) {
  const t = useTranslations('ics');
  const format = useFormatter();
  const preset = findPreset(subscription.presetId);

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5" data-testid="subscription-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-2 font-display text-body font-semibold text-ink">
            <span
              aria-hidden
              data-testid="subscription-color-dot"
              data-color={subscription.color}
              className={cn('size-3 shrink-0 rounded-full', COLOR_DOT[subscription.color])}
            />
            {subscription.name}
          </span>
          {/* The masked link (`redactFeedUrl`), never the whole one: the token
              in it opens the school's agenda without a login, and this card is
              rendered on a wall tablet in the hall. */}
          <span className="text-caption break-all text-ink-muted" data-testid="subscription-url">
            {subscription.urlLabel}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={subscription.enabled ? 'secondary' : 'outline'}>
              {subscription.enabled ? t('status.active') : t('status.paused')}
            </Badge>
            <Badge variant="outline">{t('readOnly')}</Badge>
            {preset ? (
              <Badge variant="outline" data-testid="subscription-preset">
                {t(`presets.${preset.key}.label` as 'presets.parro.label')}
              </Badge>
            ) : null}
          </div>
          <span className="text-caption text-ink-muted" data-testid="subscription-last-sync">
            {subscription.lastSyncedAt
              ? t('lastSynced', { when: format.relativeTime(subscription.lastSyncedAt) })
              : t('never')}
          </span>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton subscriptionId={subscription.id} />
            <EnabledToggle subscriptionId={subscription.id} enabled={subscription.enabled} />
            <RemoveButton subscription={subscription} />
          </div>
        ) : null}
      </div>

      {/* The failure a parent has to be able to act on: the feed is still on
          the board with its last good events, and this line is the only thing
          that says the school's server stopped answering three days ago. */}
      {subscription.lastError ? (
        <p
          role="status"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-body-sm text-destructive"
          data-testid="subscription-error"
        >
          {t(`errors.${subscription.lastError}` as 'errors.forbidden')}
          {subscription.lastErrorAt
            ? ` · ${t('lastFailed', { when: format.relativeTime(subscription.lastErrorAt) })}`
            : ''}
        </p>
      ) : null}

      {/* A broken feed usually means the school rotated the link, and the fix is
          the same click path that produced it. Showing it here saves a parent
          from having to remember where they found it a year ago. */}
      {subscription.lastError && preset ? <PresetInstructions preset={preset} /> : null}
    </Card>
  );
}

function RefreshButton({ subscriptionId }: { subscriptionId: string }) {
  const t = useTranslations('ics');
  const [, action, pending] = useActionState<ActionState, FormData>(
    refreshSubscriptionAction,
    idleState
  );

  return (
    <form action={action}>
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <Button type="submit" size="sm" variant="brand-outline" disabled={pending}>
        {t('refreshNow')}
      </Button>
    </form>
  );
}

function EnabledToggle({ subscriptionId, enabled }: { subscriptionId: string; enabled: boolean }) {
  const t = useTranslations('ics');
  const [, action, pending] = useActionState<ActionState, FormData>(
    setSubscriptionEnabledAction,
    idleState
  );

  return (
    <form action={action}>
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <Button
        type="submit"
        size="sm"
        variant={enabled ? 'secondary' : 'outline'}
        disabled={pending}
      >
        {enabled ? t('pause') : t('resume')}
      </Button>
    </form>
  );
}

function RemoveButton({ subscription }: { subscription: SubscriptionView }) {
  const t = useTranslations('ics');
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeSubscriptionAction,
    idleState
  );
  const [confirming, setConfirming] = useState(false);
  const { locked, lock } = useSubmitGuard(pending);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive-soft"
        onClick={() => setConfirming(true)}
        disabled={pending}
        data-testid="remove-subscription"
      >
        {t('remove')}
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="hub" data-testid="remove-subscription-confirm">
          <form action={action} onSubmit={lock} className="flex flex-col gap-4">
            <input type="hidden" name="subscriptionId" value={subscription.id} />
            <AlertDialogHeader>
              <AlertDialogTitle>{t('removeConfirm.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('removeConfirm.body', {
                  name: subscription.name,
                  count: subscription.eventCount,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose
                render={
                  <Button type="button" variant="ghost" size="hub">
                    {t('removeConfirm.cancel')}
                  </Button>
                }
              />
              <Button
                type="submit"
                variant="destructive"
                size="hub"
                disabled={locked}
                data-testid="remove-subscription-confirm-yes"
              >
                {t('removeConfirm.confirm')}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {state.status === 'error' ? (
        <span role="alert" className="text-xs text-destructive">
          {t(`errors.${state.error}` as 'errors.forbidden')}
        </span>
      ) : null}
    </>
  );
}
