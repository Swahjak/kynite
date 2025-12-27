"use client";

import { cn } from "@/lib/utils";
import { FamilyAvatar } from "@/components/family/family-avatar";
import { getAvatarColorClasses } from "@/lib/avatar-colors";
import type { AvatarColor } from "@/types/family";

export interface PersonCard {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  avatarSvg?: string | null;
}

interface PersonSelectorCardsProps {
  people: PersonCard[];
  selectedId: string | "all";
  onSelect: (id: string | "all") => void;
}

export function PersonSelectorCards({
  people,
  selectedId,
  onSelect,
}: PersonSelectorCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {people.map((person) => {
        const color = getAvatarColorClasses(person.avatarColor as AvatarColor);
        const isSelected = selectedId === person.id;
        const borderClass = color.ring.replace("ring-", "border-");

        return (
          <button
            key={person.id}
            onClick={() => onSelect(person.id)}
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-transform active:scale-95",
              borderClass,
              isSelected
                ? `ring-primary ring-offset-background ring-2 ring-offset-2 ${color.bgSubtle}`
                : "bg-background"
            )}
          >
            <FamilyAvatar
              name={person.name}
              color={person.avatarColor as AvatarColor}
              avatarSvg={person.avatarSvg}
              googleImage={person.avatarUrl}
              size="lg"
              showRing={false}
              className="size-20 text-2xl sm:size-24 sm:text-3xl"
            />
            <span className="text-base font-medium">{person.name}</span>
          </button>
        );
      })}
    </div>
  );
}
