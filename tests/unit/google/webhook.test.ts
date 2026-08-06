import { describe, expect, it } from 'vitest';
import {
  decideNotification,
  readNotification,
  type ChannelRegistration,
} from '@/modules/google/domain/webhook';

/**
 * Push-notification validation (docs/architecture.md §5 "Push channels").
 * The route does one lookup and calls this; every rule is asserted here.
 */

const registration: ChannelRegistration = {
  calendarId: '11111111-1111-4111-8111-111111111111',
  channelResourceId: 'resource-abc',
  expectedToken: 'derived-token',
  syncEnabled: true,
};

function notification(overrides: Record<string, string> = {}): Headers {
  return new Headers({
    'x-goog-channel-id': 'channel-1',
    'x-goog-channel-token': 'derived-token',
    'x-goog-resource-id': 'resource-abc',
    'x-goog-resource-state': 'exists',
    ...overrides,
  });
}

describe('readNotification', () => {
  it('reads the four Google headers', () => {
    expect(readNotification(notification())).toEqual({
      channelId: 'channel-1',
      channelToken: 'derived-token',
      resourceId: 'resource-abc',
      resourceState: 'exists',
    });
  });
});

describe('decideNotification', () => {
  it('queues a sync for a valid change notification', () => {
    expect(decideNotification(readNotification(notification()), registration)).toEqual({
      action: 'sync',
      calendarId: registration.calendarId,
    });
  });

  it('rejects a wrong channel token', () => {
    const decision = decideNotification(
      readNotification(notification({ 'x-goog-channel-token': 'guessed' })),
      registration
    );
    expect(decision).toEqual({ action: 'reject', reason: 'bad_channel_token' });
  });

  it('rejects a missing channel token', () => {
    const headers = notification();
    headers.delete('x-goog-channel-token');
    expect(decideNotification(readNotification(headers), registration)).toMatchObject({
      action: 'reject',
      reason: 'bad_channel_token',
    });
  });

  it('rejects a resource id that does not match the stored channel', () => {
    const decision = decideNotification(
      readNotification(notification({ 'x-goog-resource-id': 'resource-other' })),
      registration
    );
    expect(decision).toEqual({ action: 'reject', reason: 'resource_id_mismatch' });
  });

  it('rejects an unknown channel', () => {
    expect(decideNotification(readNotification(notification()), null)).toEqual({
      action: 'reject',
      reason: 'unknown_channel',
    });
  });

  it('rejects a notification with no channel id at all', () => {
    const headers = notification();
    headers.delete('x-goog-channel-id');
    expect(decideNotification(readNotification(headers), registration)).toEqual({
      action: 'reject',
      reason: 'missing_channel_id',
    });
  });

  it('ignores the channel-creation handshake', () => {
    const decision = decideNotification(
      readNotification(notification({ 'x-goog-resource-state': 'sync' })),
      registration
    );
    expect(decision).toEqual({ action: 'ignore', reason: 'channel_handshake' });
  });

  it('ignores notifications for a calendar the family paused', () => {
    const decision = decideNotification(readNotification(notification()), {
      ...registration,
      syncEnabled: false,
    });
    expect(decision).toEqual({ action: 'ignore', reason: 'sync_disabled' });
  });

  it('does not require a resource id when the channel has none stored yet', () => {
    const headers = notification();
    headers.delete('x-goog-resource-id');
    expect(
      decideNotification(readNotification(headers), { ...registration, channelResourceId: null })
    ).toMatchObject({ action: 'sync' });
  });
});
