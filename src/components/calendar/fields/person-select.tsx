"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedUser.avatarUrl} />
                <AvatarFallback
                  className={selectedUser.avatarColor ?? "bg-primary"}
                  style={{ fontSize: "0.625rem" }}
                >
                  {selectedUser.avatarFallback}
                </AvatarFallback>
              </Avatar>
              <span>{selectedUser.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback
                  className={user.avatarColor ?? "bg-primary"}
                  style={{ fontSize: "0.625rem" }}
                >
                  {user.avatarFallback}
                </AvatarFallback>
              </Avatar>
              <span>{user.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
