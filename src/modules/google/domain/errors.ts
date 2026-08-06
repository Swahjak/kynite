/**
 * The error vocabulary the sync and push engines branch on. Lives in `domain/`
 * because the engines are pure: the HTTP client raises these, and the fixture
 * doubles raise exactly the same ones.
 */

/** Any non-2xx from the Calendar API. `status` is what the engines dispatch on. */
export class GoogleApiError extends Error {
  readonly status: number;
  /** Google's machine-readable `error.errors[0].reason`, when present. */
  readonly reason: string | null;

  constructor(status: number, message: string, reason: string | null = null) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.reason = reason;
  }

  /** Sync token expired — §5: drop the token and run a full resync. */
  get isGone(): boolean {
    return this.status === 410;
  }

  /** `If-Match` lost — §5: refetch and resolve last-write-wins. */
  get isPreconditionFailed(): boolean {
    return this.status === 412;
  }

  /** An insert whose caller-assigned id already exists — a retried push. */
  get isDuplicate(): boolean {
    return this.status === 409;
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.status === 410;
  }

  /** Rate limit / backend blip: worth a job retry, unlike a 4xx. */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/** A token endpoint failure. `invalid_grant` is the one that ends the account. */
export class GoogleAuthError extends Error {
  readonly error: string;

  constructor(error: string, description?: string) {
    super(description ? `${error}: ${description}` : error);
    this.name = 'GoogleAuthError';
    this.error = error;
  }

  /**
   * The refresh token is dead — revoked, expired after 6 months idle, or
   * invalidated by a password change. §5: mark the account `reauth_required`.
   */
  get isInvalidGrant(): boolean {
    return this.error === 'invalid_grant';
  }
}
