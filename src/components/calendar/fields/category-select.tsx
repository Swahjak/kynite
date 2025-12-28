"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type TEventCategory,
  CATEGORIES,
  CATEGORY_COLORS,
} from "@/components/calendar/types";
import { cn } from "@/lib/utils";

interface CategorySelectProps {
  value: TEventCategory;
  onValueChange: (value: TEventCategory) => void;
  disabled?: boolean;
}

const colorClasses: Record<string, string> = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
};

export function CategorySelect({
  value,
  onValueChange,
  disabled = false,
}: CategorySelectProps) {
  const t = useTranslations("Categories");

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TEventCategory)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                colorClasses[CATEGORY_COLORS[value]]
              )}
            />
            <span>{t(value)}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-3 w-3 rounded-full",
                  colorClasses[CATEGORY_COLORS[category]]
                )}
              />
              <span>{t(category)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
