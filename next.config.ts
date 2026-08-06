import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Playwright drives the dev server over 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1'],
};

export default withNextIntl(nextConfig);
