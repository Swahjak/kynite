import { describe, expect, it } from 'vitest';
import {
  presentationFor,
  resolveSurface,
  type ResolveSurfaceInput,
  type Surface,
} from '@/modules/surface/resolve';

const base: ResolveSurfaceInput = {
  isDevicePrincipal: false,
  cookieValue: undefined,
  secChUaMobile: undefined,
  userAgent: undefined,
};

const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

const IPAD_SPOOFED_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('resolveSurface', () => {
  it('a paired device always renders the hub, over cookie and header signals', () => {
    const input: ResolveSurfaceInput = {
      isDevicePrincipal: true,
      cookieValue: 'app',
      secChUaMobile: '?1',
      userAgent: IPHONE_SAFARI_UA,
    };
    expect(resolveSurface(input)).toBe('hub');
  });

  it("honours an 'app' cookie, ignoring headers", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      cookieValue: 'app',
      secChUaMobile: '?0',
      userAgent: DESKTOP_CHROME_UA,
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it("honours a 'desktop' cookie, ignoring headers", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      cookieValue: 'desktop',
      secChUaMobile: '?1',
      userAgent: IPHONE_SAFARI_UA,
    };
    expect(resolveSurface(input)).toBe('desktop');
  });

  it("ignores a 'hub' cookie and falls through to header resolution", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      cookieValue: 'hub',
      secChUaMobile: '?1',
      userAgent: undefined,
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it('ignores a garbage cookie value and falls through', () => {
    const input: ResolveSurfaceInput = {
      ...base,
      cookieValue: 'xyz',
      secChUaMobile: '?1',
      userAgent: undefined,
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it('ignores an empty-string cookie value and falls through', () => {
    const input: ResolveSurfaceInput = {
      ...base,
      cookieValue: '',
      userAgent: IPHONE_SAFARI_UA,
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it('ignores a null cookie value and falls through', () => {
    const input: ResolveSurfaceInput = {
      ...base,
      cookieValue: null,
      userAgent: IPHONE_SAFARI_UA,
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it("treats Sec-CH-UA-Mobile '?1' as a mobile phone → 'app'", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      secChUaMobile: '?1',
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it("falls back to UA sniffing when Sec-CH-UA-Mobile is '?0' but the UA is a phone", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      secChUaMobile: '?0',
      userAgent: IPHONE_SAFARI_UA,
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it("sniffs an Android phone UA containing 'Mobile' → 'app'", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      userAgent: ANDROID_PHONE_UA,
    };
    expect(resolveSurface(input)).toBe('app');
  });

  it("treats a Mac-spoofed iPad UA as 'desktop' (tablets never get 'app')", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      userAgent: IPAD_SPOOFED_UA,
    };
    expect(resolveSurface(input)).toBe('desktop');
  });

  it("treats a desktop Chrome/Windows UA as 'desktop'", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      userAgent: DESKTOP_CHROME_UA,
    };
    expect(resolveSurface(input)).toBe('desktop');
  });

  it("defaults to 'desktop' when the userAgent is null", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      userAgent: null,
    };
    expect(resolveSurface(input)).toBe('desktop');
  });

  it("defaults to 'desktop' when the userAgent is undefined", () => {
    const input: ResolveSurfaceInput = {
      ...base,
      userAgent: undefined,
    };
    expect(resolveSurface(input)).toBe('desktop');
  });

  it("defaults to 'desktop' with no cookie and no headers at all", () => {
    expect(resolveSurface(base)).toBe('desktop');
  });
});

describe('presentationFor', () => {
  const expected: Record<Surface, 'app' | 'hub'> = {
    app: 'app',
    desktop: 'hub',
    hub: 'hub',
  };

  it.each(Object.entries(expected) as [Surface, 'app' | 'hub'][])(
    'maps %s → %s',
    (surface, presentation) => {
      expect(presentationFor(surface)).toBe(presentation);
    }
  );
});
