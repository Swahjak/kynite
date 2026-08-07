import { env } from '@/server/env';

/**
 * Web push configuration (docs/architecture.md §6 "Web push (parents only)").
 *
 * Same posture as `modules/google/config.ts`, and for the same reason: an
 * install with no VAPID keypair is a *working* install with notifications
 * switched off, not a boot failure. Everything that would talk to a push
 * service goes through `assertPushConfigured()` first, and the settings panel
 * reads `missingPushConfig()` to say what is absent rather than offering an
 * opt-in that could only fail.
 */

export class PushNotConfiguredError extends Error {
  constructor(missing: readonly string[]) {
    super(`Web push is not configured — missing: ${missing.join(', ')}`);
    this.name = 'PushNotConfiguredError';
  }
}

export type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/**
 * The RFC 8292 `sub` claim when none is configured. A `mailto:` is required by
 * the spec and by every real push service; this keeps a dev install working
 * without inventing a contact address that looks real.
 */
export const DEFAULT_VAPID_SUBJECT = 'mailto:notifications@kynite.local';

/** Which required variables are absent, in the order the settings panel lists them. */
export function missingPushConfig(): string[] {
  const missing: string[] = [];
  if (!env.VAPID_PUBLIC_KEY) missing.push('VAPID_PUBLIC_KEY');
  if (!env.VAPID_PRIVATE_KEY) missing.push('VAPID_PRIVATE_KEY');
  return missing;
}

export function isPushConfigured(): boolean {
  return missingPushConfig().length === 0;
}

export function assertPushConfigured(): PushConfig {
  const missing = missingPushConfig();
  if (missing.length > 0) throw new PushNotConfiguredError(missing);

  return {
    publicKey: env.VAPID_PUBLIC_KEY!,
    privateKey: env.VAPID_PRIVATE_KEY!,
    subject: env.VAPID_SUBJECT ?? DEFAULT_VAPID_SUBJECT,
  };
}

/**
 * The application server key the browser needs for `pushManager.subscribe()`.
 *
 * Read at *request* time and handed to the client as a prop, deliberately —
 * see `src/server/env.ts` for why there is no `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
 * `null` (rather than a throw) so a server component can render "push is not
 * configured here" instead of a 500.
 */
export function pushPublicKey(): string | null {
  return isPushConfigured() ? (env.VAPID_PUBLIC_KEY ?? null) : null;
}
