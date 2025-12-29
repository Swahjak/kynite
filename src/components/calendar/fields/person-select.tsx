"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FamilyAvatar } from "@/components/family/family-avatar";
import type { IUser } from "@/components/calendar/interfaces";

interface PersonSelectProps {
  users: IUser[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PersonSelect({
  users,
  value,
  onValueChange,
  placeholder = "Select person",
  disabled = false,
}: PersonSelectProps) {
  const selectedUser = users.find((u) => u.id === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedUser && (
            <div className="flex items-center gap-2">
              <FamilyAvatar
                name={selectedUser.name}
                color={selectedUser.avatarColor}
                avatarSvg={selectedUser.avatarSvg}
                googleImage={selectedUser.avatarUrl}
                size="sm"
                showRing={false}
                className="size-5"
              />
              <span>{selectedUser.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <div className="flex items-center gap-2">
              <FamilyAvatar
                name={user.name}
                color={user.avatarColor}
                avatarSvg={user.avatarSvg}
                googleImage={user.avatarUrl}
                size="sm"
                showRing={false}
                className="size-5"
              />
              <span>{user.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
