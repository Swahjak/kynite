import { DesignShowcase } from './design-showcase';

/**
 * Internal design-system reference. Renders every design token and every core
 * primitive in both themes.
 *
 * Not reachable in production (gated structurally by `dev/layout.tsx`, which
 * every /dev/* route goes through) and deliberately not linked from any
 * product navigation — it exists for review, visual regression and the
 * accessibility audit only. `?theme=dark` forces the dark theme so tests are
 * deterministic.
 */
export const dynamic = 'force-dynamic';

export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme } = await searchParams;

  return <DesignShowcase initialTheme={theme === 'dark' ? 'dark' : 'light'} />;
}
