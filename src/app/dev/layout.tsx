import type { Metadata } from 'next';
import { fontVariables } from '@/lib/fonts';
import '../globals.css';

/**
 * Root layout for the internal `/dev/*` tooling routes. These live outside the
 * `[locale]` tree on purpose: they are English-only, never linked from product
 * navigation, and `src/proxy.ts` excludes `/dev` from locale negotiation.
 */
export const metadata: Metadata = {
  title: 'Kynite — internal',
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
