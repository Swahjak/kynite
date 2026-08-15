'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { Button, Icon, Input } from '@kynite/ui';
import { createShareLinkIdle, type CreateShareLinkState } from '../action-state';
import { createShareLinkAction } from '../actions';
import { SHARE_SURFACE_CHOICES, type ShareSurface } from '../domain/scope';
import type { SharingPageData } from '../page-data';
import { ShareQr } from './share-qr';

/**
 * "Make a link" — role, who it covers, what it opens, when it stops working.
 *
 * The link is shown **once**, and the copy says so before the parent has to
 * find out. There is no recovery path by design: only `sha256('share:' + …)`
 * is stored, so a parent who loses the URL makes a new link, exactly as a
 * parent who loses a pairing code makes a new code (M12). The QR is not a
 * convenience feature — a grandparent is the target user, and "point your
 * camera at this" beats "type this 43-character string" by a distance that
 * decides whether the feature gets used at all.
 *
 * Defaults are the safe ones: `viewer`, everybody, everything, 30 days. A
 * parent who wants a contributor link says so; a parent in a hurry gets a
 * read-only link that expires on its own.
 */
export function CreateShareLinkPanel({
  members,
  calendars,
}: {
  members: SharingPageData['members'];
  calendars: SharingPageData['calendars'];
}) {
  const t = useTranslations('sharing');
  const formatDateTime = useDateTimeFormat();

  const [state, setState] = useState<CreateShareLinkState>(createShareLinkIdle);
  const [role, setRole] = useState<'viewer' | 'contributor'>('viewer');
  const [label, setLabel] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [calendarIds, setCalendarIds] = useState<string[]>([]);
  const [surfaces, setSurfaces] = useState<ShareSurface[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = <T,>(values: T[], value: T): T[] =>
    values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCopied(false);
    startTransition(async () => {
      setState(
        await createShareLinkAction({
          role,
          label: label.trim() || undefined,
          memberIds: memberIds.length > 0 ? memberIds : undefined,
          calendarIds: calendarIds.length > 0 ? calendarIds : undefined,
          surfaces: surfaces.length > 0 ? surfaces : undefined,
          expiresInDays,
        })
      );
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-semibold text-ink">{t('create.title')}</h2>
        <p className="text-body-sm text-ink-secondary">{t('create.description')}</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-medium">{t('create.labelLabel')}</span>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('create.labelPlaceholder')}
            maxLength={60}
            data-testid="share-label-input"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm font-medium">{t('create.roleLabel')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['viewer', 'contributor'] as const).map((value) => (
              <label
                key={value}
                className="flex min-h-12 items-center gap-2 rounded-4xl border border-border bg-surface-container-lowest px-4 py-2 text-body-sm transition-colors duration-200 ease-brand has-checked:border-primary has-checked:bg-brand-container/20"
              >
                <input
                  type="radio"
                  name="share-role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  data-testid={`share-role-${value}`}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{t(`roles.${value}`)}</span>
                  <span className="text-ink-secondary">{t(`roleHints.${value}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm font-medium">{t('create.membersLabel')}</legend>
          <p className="text-body-sm text-ink-secondary">{t('create.membersHint')}</p>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex min-h-12 items-center gap-2 rounded-4xl border border-border bg-surface-container-lowest px-4 py-2 text-body-sm transition-colors duration-200 ease-brand has-checked:border-primary has-checked:bg-brand-container/20"
              >
                <input
                  type="checkbox"
                  checked={memberIds.includes(member.id)}
                  onChange={() => setMemberIds((current) => toggle(current, member.id))}
                  data-testid={`share-member-${member.id}`}
                />
                {member.displayName}
              </label>
            ))}
          </div>
        </fieldset>

        {calendars.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-body-sm font-medium">{t('create.calendarsLabel')}</legend>
            <p className="text-body-sm text-ink-secondary">{t('create.calendarsHint')}</p>
            <div className="flex flex-wrap gap-2">
              {calendars.map((entry) => (
                <label
                  key={entry.id}
                  className="flex min-h-12 items-center gap-2 rounded-4xl border border-border bg-surface-container-lowest px-4 py-2 text-body-sm transition-colors duration-200 ease-brand has-checked:border-primary has-checked:bg-brand-container/20"
                >
                  <input
                    type="checkbox"
                    checked={calendarIds.includes(entry.id)}
                    onChange={() => setCalendarIds((current) => toggle(current, entry.id))}
                  />
                  {entry.summary}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm font-medium">{t('create.surfacesLabel')}</legend>
          <p className="text-body-sm text-ink-secondary">{t('create.surfacesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {SHARE_SURFACE_CHOICES.map((surface) => (
              <label
                key={surface}
                className="flex min-h-12 items-center gap-2 rounded-4xl border border-border bg-surface-container-lowest px-4 py-2 text-body-sm transition-colors duration-200 ease-brand has-checked:border-primary has-checked:bg-brand-container/20"
              >
                <input
                  type="checkbox"
                  checked={surfaces.includes(surface)}
                  onChange={() => setSurfaces((current) => toggle(current, surface))}
                  data-testid={`share-surface-${surface}`}
                />
                {t(`surfaces.${surface}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex max-w-64 flex-col gap-1">
          <span className="text-body-sm font-medium">{t('create.expiryLabel')}</span>
          <select
            className="h-12 rounded-lg border border-border bg-background px-3 text-body-sm"
            value={expiresInDays === null ? 'never' : String(expiresInDays)}
            onChange={(event) =>
              setExpiresInDays(event.target.value === 'never' ? null : Number(event.target.value))
            }
            data-testid="share-expiry-select"
          >
            <option value="1">{t('create.expiryDays', { days: 1 })}</option>
            <option value="7">{t('create.expiryDays', { days: 7 })}</option>
            <option value="30">{t('create.expiryDays', { days: 30 })}</option>
            <option value="365">{t('create.expiryDays', { days: 365 })}</option>
            <option value="never">{t('create.expiryNever')}</option>
          </select>
        </label>

        <Button type="submit" disabled={pending} className="self-start">
          <Icon name="add" size="md" inline="start" />
          {t('create.submit')}
        </Button>
      </form>

      {state.status === 'created' ? (
        <output
          className="flex flex-col gap-3 rounded-xl bg-surface-container p-4"
          data-testid="share-created"
        >
          <span className="font-display text-body font-semibold text-ink">
            {t('created.title')}
          </span>
          <span className="text-body-sm text-ink-secondary">{t('created.onceWarning')}</span>

          <code
            className="break-all rounded-lg border border-border bg-background p-3 text-body-sm"
            data-testid="share-url"
          >
            {state.url}
          </code>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(state.url).then(() => setCopied(true));
              }}
            >
              {copied ? t('created.copied') : t('created.copy')}
            </Button>
            {state.expiresAt ? (
              <span className="text-body-sm text-ink-secondary">
                {t('created.expiresAt', {
                  date: formatDateTime(new Date(state.expiresAt), {
                    day: 'numeric',
                    month: 'long',
                  }),
                })}
              </span>
            ) : (
              <span className="text-body-sm text-ink-secondary">{t('created.noExpiry')}</span>
            )}
          </div>

          <ShareQr url={state.url} />
        </output>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" className="text-body-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </section>
  );
}
