/**
 * Last-write-wins conflict resolution (docs/architecture.md §5 "Write path",
 * PRD: LWW).
 *
 * Reached from exactly one place: a `412 Precondition Failed` on our
 * `If-Match: etag` write, which means the remote copy changed after the etag we
 * held was issued. We refetch and compare `updated` timestamps.
 *
 * **Ties break toward Google**, because Google is the multi-tenant source of
 * truth — the other side of a tie may be a phone we will never hear from
 * again, while our own copy is one refetch away from being correct. Risk §11.4
 * (silent data loss) is accepted by the PRD and mitigated later by an audit
 * trail, not by changing the rule here.
 */

export type ConflictWinner = 'local' | 'remote';

export type ConflictInput = {
  /** When our copy was last written locally. */
  localUpdatedAt: Date | null | undefined;
  /** Google's `updated` on the refetched resource. */
  remoteUpdatedAt: Date | null | undefined;
};

export function resolveConflict({
  localUpdatedAt,
  remoteUpdatedAt,
}: ConflictInput): ConflictWinner {
  // No remote timestamp: nothing to lose to, so our write proceeds.
  if (!remoteUpdatedAt || Number.isNaN(remoteUpdatedAt.getTime())) return 'local';
  // No local timestamp: we cannot claim to be newer.
  if (!localUpdatedAt || Number.isNaN(localUpdatedAt.getTime())) return 'remote';

  // Strictly greater — equal timestamps are a tie, and ties go to Google.
  return localUpdatedAt.getTime() > remoteUpdatedAt.getTime() ? 'local' : 'remote';
}
