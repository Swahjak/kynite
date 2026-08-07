import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/nl.json';
import { OfflineIndicator, isOfflineStatus } from '@/components/offline/offline-indicator';
import { RealtimeProvider } from '@/components/realtime';

/**
 * M11: "The offline indicator derives from SSE connection state, not
 * `navigator.onLine` — asserted by a test that fakes `onLine: true` with a
 * dead stream."
 *
 * That is the whole point of the criterion and it is worth stating plainly:
 * `navigator.onLine` answers "does this device have *a* network interface",
 * not "can it reach Kynite". A wall tablet on a captive-portal guest wifi, or
 * on a router whose uplink is down, reports `true` forever while every number
 * on the board silently ages. §6 chose the stream because the stream is the
 * only thing on the device that has actually talked to the server.
 *
 * So the fake below is deliberately hostile: the browser insists it is online,
 * and the stream is dead. The indicator must believe the stream.
 */

/** A stand-in `EventSource` whose behaviour each test dictates. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(): void {}

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  /** The stream connects and says hello — a healthy hub. */
  open(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  /**
   * The stream dies. `CONNECTING` (not `CLOSED`) is the realistic shape: the
   * browser is retrying by itself, which is exactly the state a captive
   * portal produces and exactly the state `navigator.onLine` misreports.
   */
  die(): void {
    this.readyState = FakeEventSource.CONNECTING;
    this.onerror?.();
  }
}

function renderIndicator() {
  return render(
    <NextIntlClientProvider locale="nl" messages={messages}>
      <RealtimeProvider>
        <OfflineIndicator />
      </RealtimeProvider>
    </NextIntlClientProvider>
  );
}

const OFFLINE_COPY = messages.offline.lastKnown;

describe('offline indicator', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    // The lie. Every test in this file runs with the browser insisting the
    // device is online.
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the last-known notice when the stream is dead but `onLine` is true', async () => {
    renderIndicator();

    expect(navigator.onLine).toBe(true);
    const [stream] = FakeEventSource.instances;
    expect(stream, 'the provider should have opened a stream').toBeDefined();

    stream.die();

    await waitFor(() => {
      expect(screen.getByTestId('offline-indicator')).toHaveTextContent(OFFLINE_COPY);
    });
    // Still online, as far as the browser is concerned.
    expect(navigator.onLine).toBe(true);
  });

  it('renders nothing at all while the stream is healthy', async () => {
    renderIndicator();
    FakeEventSource.instances[0].open();

    await waitFor(() => {
      expect(screen.queryByTestId('offline-indicator')).toBeNull();
    });
  });

  it('says nothing during a reconnect that has not failed yet', () => {
    // `connecting` is the normal state on every page load. An indicator that
    // flashed here would be on screen more often than not.
    renderIndicator();
    expect(screen.queryByTestId('offline-indicator')).toBeNull();
    expect(isOfflineStatus('connecting')).toBe(false);
  });

  it('goes away again when the stream comes back', async () => {
    renderIndicator();
    const [stream] = FakeEventSource.instances;

    stream.die();
    await waitFor(() => expect(screen.getByTestId('offline-indicator')).toBeInTheDocument());

    stream.open();
    await waitFor(() => expect(screen.queryByTestId('offline-indicator')).toBeNull());
  });

  it('is announced politely, never as an alert', async () => {
    renderIndicator();
    FakeEventSource.instances[0].die();

    const indicator = await screen.findByTestId('offline-indicator');
    // FR21 asks for a *non-disruptive* indicator. `role="alert"` would
    // interrupt a screen reader mid-sentence; `status` + `polite` waits.
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator.getAttribute('role')).not.toBe('alert');
  });

  it('maps only the offline status to the notice', () => {
    expect(isOfflineStatus('offline')).toBe(true);
    expect(isOfflineStatus('open')).toBe(false);
    expect(isOfflineStatus('connecting')).toBe(false);
  });
});
