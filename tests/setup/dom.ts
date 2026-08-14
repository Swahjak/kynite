import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * jsdom ships no `ResizeObserver`, and Base UI's anchored popups (Popover,
 * Select, Menu) observe their anchor through Floating UI's `autoUpdate` the
 * moment they open. Without this stub every popover test throws before it can
 * assert anything. Measuring is meaningless in jsdom anyway — a no-op observer
 * is the honest shape of it.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
});
