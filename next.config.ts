import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import nextra from "nextra";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withNextra = nextra({
  contentDirBasePath: "/help",
  unstable_shouldAddLocaleToLinks: true,
});

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://accounts.google.com https://*.googleapis.com wss://*.pusher.com https://*.pusherapp.com",
      "frame-src 'self' https://accounts.google.com",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Nextra i18n configuration (handled by withNextra even in App Router)
  i18n: {
    locales: ["en", "nl"],
    defaultLocale: "en",
  },
} as NextConfig & { i18n: { locales: string[]; defaultLocale: string } };

export default withNextIntl(withNextra(nextConfig));
