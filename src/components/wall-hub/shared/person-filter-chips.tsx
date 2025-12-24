"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getUserColorById } from "./user-colors";

/**
 * Generic person shape for filter chips.
 * Compatible with both IUser (calendar) and FamilyMember (chores/reward-chart).
 */
export interface PersonChip {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
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
    <div className="flex flex-wrap gap-2">
      {showEveryone && (
        <button
          onClick={() => onSelect("all")}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
            selectedId === "all"
              ? "bg-foreground text-background"
              : "bg-background hover:bg-muted border"
          )}
        >
          <Users className="size-4" />
          Everyone
        </button>
      )}
      {people.map((person) => {
        const color = getUserColorById(person.id);
        const isSelected = selectedId === person.id;
        const fallback =
          person.avatarFallback || person.name.charAt(0).toUpperCase();
        return (
          <button
            key={person.id}
            onClick={() => onSelect(person.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border-2 pr-4 pl-1.5 text-sm font-medium transition-colors",
              color.border,
              isSelected ? `${color.activeBg} text-white` : `${color.bg}`
            )}
          >
            <Avatar className="size-7">
              <AvatarImage
                src={person.avatarUrl || undefined}
                alt={person.name}
              />
              <AvatarFallback
                style={{
                  backgroundColor: person.avatarColor || undefined,
                }}
                className="text-xs font-bold"
              >
                {fallback}
              </AvatarFallback>
            </Avatar>
            {person.name}
          </button>
        );
      })}
    </div>
  );
}
