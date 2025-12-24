"use client";

import { Link } from "@/i18n/navigation";
import { useNavigationProgress } from "@/components/providers/navigation-progress-provider";
import { usePathname } from "next/navigation";
import { type ComponentProps, useCallback } from "react";

type ProgressLinkProps = ComponentProps<typeof Link>;

export function ProgressLink({
  href,
  onClick,
  children,
  ...props
}: ProgressLinkProps) {
  const { startProgress } = useNavigationProgress();
  const pathname = usePathname();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Don't trigger progress for same-page or hash links
      const hrefString = typeof href === "string" ? href : href.pathname || "";
      if (hrefString === pathname || hrefString.startsWith("#")) {
        onClick?.(e);
        return;
      }

      startProgress();
      onClick?.(e);
    },
    [href, pathname, startProgress, onClick]
  );

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
