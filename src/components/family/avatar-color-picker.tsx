"use client";

import { cn } from "@/lib/utils";
import type { AvatarColor } from "@/types/family";
import { AVATAR_COLORS } from "@/types/family";

interface AvatarColorPickerProps {
  value: AvatarColor | null;
  onChange: (color: AvatarColor | null) => void;
}

export function AvatarColorPicker({ value, onChange }: AvatarColorPickerProps) {
  const colorClassMap: Record<AvatarColor, string> = {
    blue: "bg-[var(--event-blue-border)]",
    purple: "bg-[var(--event-purple-border)]",
    orange: "bg-[var(--event-orange-border)]",
    green: "bg-[var(--event-green-border)]",
    red: "bg-[var(--event-red-border)]",
    yellow: "bg-[var(--event-yellow-border)]",
    pink: "bg-[var(--event-pink-border)]",
    teal: "bg-[var(--event-teal-border)]",
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {AVATAR_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(value === color ? null : color)}
          className={cn(
            "size-10 rounded-full transition-all hover:scale-110",
            colorClassMap[color],
            value === color &&
              "ring-ring ring-offset-background ring-2 ring-offset-2"
          )}
          aria-label={`Select ${color} color`}
          aria-pressed={value === color}
        />
      ))}
    </div>
  );
}
