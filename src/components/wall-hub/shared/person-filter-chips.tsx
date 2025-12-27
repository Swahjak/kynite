"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamilyAvatar } from "@/components/family/family-avatar";
import { getAvatarColorClasses } from "@/lib/avatar-colors";
import type { AvatarColor } from "@/types/family";

/**
 * Generic person shape for filter chips.
 * Compatible with both IUser (calendar) and FamilyMember (chores/reward-chart).
 */
export interface PersonChip {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  avatarSvg?: string | null;
  avatarFallback?: string;
}

interface PersonFilterChipsProps {
  people: PersonChip[];
  selectedId: string | "all";
  onSelect: (id: string | "all") => void;
  showEveryone?: boolean;
}

export function PersonFilterChips({
  people,
  selectedId,
  onSelect,
  showEveryone = true,
}: PersonFilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {showEveryone && (
        <button
          onClick={() => onSelect("all")}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium transition-colors sm:px-4",
            selectedId === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted border"
          )}
        >
          <Users className="size-4" />
          <span className="hidden sm:inline">Everyone</span>
        </button>
      )}
      {people.map((person) => {
        const color = getAvatarColorClasses(person.avatarColor as AvatarColor);
        const isSelected = selectedId === person.id;
        // Convert ring class to border class for button styling
        const borderClass = color.ring.replace("ring-", "border-");

        return (
          <button
            key={person.id}
            onClick={() => onSelect(person.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border-2 pr-4 pl-1.5 text-sm font-medium transition-colors",
              borderClass,
              isSelected ? `${color.bg} text-white` : color.bgSubtle
            )}
          >
            <FamilyAvatar
              name={person.name}
              color={person.avatarColor as AvatarColor}
              avatarSvg={person.avatarSvg}
              googleImage={person.avatarUrl}
              size="sm"
              showRing={false}
              className="size-7"
            />
            {person.name}
          </button>
        );
      })}
    </div>
  );
}
