'use client';

import { useTransition } from 'react';
import { Button, Icon } from '@kynite/ui';
import { oauthConsentAction } from '../actions';

/**
 * Approve/deny controls for `(app)/oauth/consent`. Scope labels arrive
 * pre-translated from the server component — this stays a dumb renderer plus
 * two buttons, the same split every other client form in this app keeps
 * between the page (translates, loads data) and the form (submits).
 */
export function OAuthConsentForm({
  scopesHeading,
  scopeLabels,
  approveLabel,
  denyLabel,
  footer,
  oauthQuery,
}: {
  scopesHeading: string;
  scopeLabels: string[];
  approveLabel: string;
  denyLabel: string;
  footer: string;
  oauthQuery: string;
}) {
  const [pending, startTransition] = useTransition();

  const decide = (accept: boolean) => {
    startTransition(async () => {
      await oauthConsentAction(accept, oauthQuery);
    });
  };

  return (
    <div className="flex flex-col gap-6" data-testid="oauth-consent-form">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-body-sm font-medium text-ink-secondary">{scopesHeading}</h2>
        <ul className="flex flex-col gap-2">
          {scopeLabels.map((label, index) => (
            <li key={index} className="flex items-center gap-2 text-body-md text-ink">
              <Icon name="check" size="sm" className="shrink-0 text-brand" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => decide(false)}
          data-testid="oauth-consent-deny"
        >
          {denyLabel}
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={pending}
          onClick={() => decide(true)}
          data-testid="oauth-consent-approve"
        >
          {approveLabel}
        </Button>
      </div>

      <p className="text-center text-body-sm text-ink-secondary">{footer}</p>
    </div>
  );
}
