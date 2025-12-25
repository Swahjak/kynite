"use client";

import { FamilyAvatar } from "@/components/family/family-avatar";
import type { IUser } from "@/components/calendar/interfaces";
import type { AvatarColor } from "@/types/family";

interface PersonHeaderProps {
  user: IUser;
}

export function PersonHeader({ user }: PersonHeaderProps) {
  return (
    <div className="bg-card border-border flex items-center gap-3 rounded-xl border p-3">
      <FamilyAvatar
        name={user.name}
        color={user.avatarColor as AvatarColor | null}
        avatarSvg={user.avatarSvg}
        googleImage={user.avatarUrl}
        size="md"
      />
      <span className="text-lg font-semibold">{user.name}</span>
    </div>
  );
}
