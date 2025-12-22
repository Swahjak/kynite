import { cn } from "@/lib/utils";

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Material Symbols icon name (e.g., "calendar_month", "settings") */
  name: string;
  /** Whether to use filled variant */
  filled?: boolean;
  /** Icon size: xs (14px), sm (18px), md (24px), lg (28px), xl (32px), 2xl (40px) */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
}

const sizeClasses = {
  xs: "text-[14px]",
  sm: "text-[18px]",
  md: "text-[24px]",
  lg: "text-[28px]",
  xl: "text-[32px]",
  "2xl": "text-[40px]",
};

export function Icon({
  name,
  filled = false,
  size = "md",
  className,
  ...props
}: IconProps) {
  return (
    <span
      className={cn(
        "material-symbols-outlined select-none",
        sizeClasses[size],
        className
      )}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
