'use client';

import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { Fab as UiFab, type FabProps as UiFabProps, type IconName } from '@kynite/ui';

/**
 * The app's `Fab`: `@kynite/ui`'s, with the `href` shape put back.
 *
 * The design system's version takes `render` for the navigating case, because
 * it may not know `next/link` exists (the boundary rule in
 * `packages/ui/eslint.config.mjs`). Every FAB in this app that navigates
 * navigates through `@/i18n/navigation`'s locale-aware `Link`, so rather than
 * repeat `render={<Link href={…} />}` at each call site — and risk one of them
 * reaching for the bare `next/link` and dropping the `/nl` prefix — the union
 * lives here once.
 */
export type FabProps = {
  icon: IconName;
  /** Accessible name. Required — a FAB with no label is an unlabelled button. */
  label: string;
  className?: string;
} & (
  | ({ href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className'>)
  | ({ href?: undefined } & Omit<ComponentProps<'button'>, 'className'>)
);

export function Fab({ icon, label, className, ...props }: FabProps) {
  if (props.href !== undefined) {
    const { href, ...rest } = props;
    return (
      <UiFab
        icon={icon}
        label={label}
        className={className}
        render={<Link href={href} {...rest} />}
      />
    );
  }

  const { href: _href, ...buttonProps } = props;
  return <UiFab {...(buttonProps as UiFabProps)} icon={icon} label={label} className={className} />;
}

export { FabSlot } from '@kynite/ui';
