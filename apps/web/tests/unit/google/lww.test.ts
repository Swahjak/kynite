import { describe, expect, it } from 'vitest';
import { resolveConflict } from '@/modules/google/domain/lww';

/**
 * Last-write-wins (docs/architecture.md §5, PRD). The tie rule is the load
 * bearing part: Google is the multi-tenant source of truth, so an exact tie
 * goes to Google rather than to whichever side happened to ask.
 */

const earlier = new Date('2026-08-02T11:00:00Z');
const later = new Date('2026-08-02T13:00:00Z');

describe('resolveConflict', () => {
  it('keeps the newer local write', () => {
    expect(resolveConflict({ localUpdatedAt: later, remoteUpdatedAt: earlier })).toBe('local');
  });

  it('takes the newer remote write', () => {
    expect(resolveConflict({ localUpdatedAt: earlier, remoteUpdatedAt: later })).toBe('remote');
  });

  it('breaks an exact tie toward Google', () => {
    expect(resolveConflict({ localUpdatedAt: later, remoteUpdatedAt: new Date(later) })).toBe(
      'remote'
    );
  });

  it('proceeds locally when the remote has no timestamp to lose to', () => {
    expect(resolveConflict({ localUpdatedAt: later, remoteUpdatedAt: null })).toBe('local');
    expect(resolveConflict({ localUpdatedAt: later, remoteUpdatedAt: undefined })).toBe('local');
  });

  it('yields when we cannot claim to be newer', () => {
    expect(resolveConflict({ localUpdatedAt: null, remoteUpdatedAt: later })).toBe('remote');
  });

  it('treats an unparseable timestamp as absent rather than as zero', () => {
    expect(resolveConflict({ localUpdatedAt: later, remoteUpdatedAt: new Date('nonsense') })).toBe(
      'local'
    );
    expect(resolveConflict({ localUpdatedAt: new Date('nonsense'), remoteUpdatedAt: later })).toBe(
      'remote'
    );
  });
});
