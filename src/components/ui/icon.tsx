import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { type LucideIcon, type LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";

const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      xs: "size-3.5", // 14px
      sm: "size-[18px]", // 18px
      md: "size-6", // 24px
      lg: "size-7", // 28px
      xl: "size-8", // 32px
      "2xl": "size-10", // 40px
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface IconProps
  extends Omit<LucideProps, "size">, VariantProps<typeof iconVariants> {
  /** The Lucide icon component to render */
  icon: LucideIcon;
}

function Icon({
  icon: LucideIconComponent,
  size,
  className,
  ...props
}: IconProps) {
  return (
    <LucideIconComponent
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    />
  );
}

export { Icon, iconVariants };
