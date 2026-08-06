import { describe, expect, it } from 'vitest';
import {
  CONTROL_SSE_EVENT,
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
  REALTIME_SSE_EVENT,
  SSE_HEADERS,
  controlFrame,
  eventFrame,
  retryFrame,
} from '@/modules/realtime/domain/frame';
import type { RealtimeEvent } from '@/modules/realtime/schema';

/**
 * The bytes on the wire (docs/architecture.md §4 "SSE endpoint").
 *
 * Asserted literally, because every failure mode of SSE framing is silent: a
 * missing blank line makes the browser wait forever for the rest of a frame,
 * and a missing `id:` line makes `Last-Event-ID` never advance — so a
 * reconnect replays from the beginning of time, or from nothing at all.
 */

const event: RealtimeEvent = {
  v: 1,
  id: '17',
  familyId: 'f1e1d1c1-0000-4000-8000-000000000000',
  type: 'completion.created',
  at: '2026-08-06T07:00:00.000Z',
  actor: { memberId: 'm1', clientId: 'tap-1', source: 'hub' },
  entity: { id: 'c1' },
};

describe('SSE framing', () => {
  it('carries the event_log id as the SSE id and terminates the frame', () => {
    const frame = eventFrame(event);

    expect(frame.startsWith('id: 17\n')).toBe(true);
    expect(frame).toContain(`event: ${REALTIME_SSE_EVENT}\n`);
    expect(frame.endsWith('\n\n')).toBe(true);

    const data = frame.split('\n').find((line) => line.startsWith('data: '));
    expect(JSON.parse(data!.slice('data: '.length))).toEqual(event);
  });

  it('gives control frames no id — a client must not adopt one as its cursor', () => {
    const frame = controlFrame({ type: 'resync', reason: 'gap', cursor: '900' });

    expect(frame).not.toMatch(/^id:/m);
    expect(frame).toContain(`event: ${CONTROL_SSE_EVENT}\n`);
    expect(JSON.parse(frame.split('data: ')[1].trim())).toEqual({
      type: 'resync',
      reason: 'gap',
      cursor: '900',
    });
  });

  it('emits the heartbeat as a comment, at §4’s 25s cadence', () => {
    expect(HEARTBEAT_FRAME).toBe(': ping\n\n');
    expect(HEARTBEAT_INTERVAL_MS).toBe(25_000);
  });

  it('sends a retry hint so a dropped stream reconnects promptly', () => {
    expect(retryFrame(1500)).toBe('retry: 1500\n\n');
  });

  it('sets the three headers the milestone names', () => {
    expect(SSE_HEADERS['Content-Type']).toMatch(/^text\/event-stream/);
    expect(SSE_HEADERS['Cache-Control']).toBe('no-store');
    expect(SSE_HEADERS['X-Accel-Buffering']).toBe('no');
  });

  it('never lets a payload newline break out of its data line', () => {
    // A title with a newline in it would otherwise terminate the frame early
    // and truncate the event. JSON escapes it; this asserts that rather than
    // assuming it.
    const withNewline: RealtimeEvent = {
      ...event,
      patch: { title: 'line one\nline two' },
    };
    const frame = eventFrame(withNewline);
    const body = frame.slice(0, -2);

    expect(body.split('\n').filter((line) => line.startsWith('data: '))).toHaveLength(1);
    expect(body).not.toContain('line one\nline two');
  });
});
