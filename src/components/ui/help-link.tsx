"use client";

import { HelpCircle } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HelpPage =
  | "getting-started"
  | "calendar"
  | "chores"
  | "rewards"
  | "wall-hub";

interface HelpLinkProps {
  page?: HelpPage;
  section?: string;
  variant?: "icon" | "text";
  className?: string;
  label?: string;
}

const pageLabels: Record<HelpPage, string> = {
  "getting-started": "Getting started help",
  calendar: "Calendar help",
  chores: "Chores help",
  rewards: "Rewards help",
  "wall-hub": "Wall hub help",
};

export function HelpLink({
  page,
  section,
  variant = "icon",
  className,
  label,
}: HelpLinkProps) {
  const locale = useLocale();

  const basePath = `/${locale}/help`;
  const pagePath = page ? `${basePath}/${page}` : basePath;
  const href = section ? `${pagePath}#${section}` : pagePath;

  const tooltipLabel = label || (page ? pageLabels[page] : "Help center");

  if (variant === "text") {
    return (
      <Link
        href={href}
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline",
          className
        )}
      >
        <HelpCircle className="size-4" />
        {tooltipLabel}
      </Link>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className={cn(
              "text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-md p-2 transition-colors",
              className
            )}
            aria-label={tooltipLabel}
          >
            <HelpCircle className="size-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltipLabel} →</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
