"use client";

import { useChores } from "../contexts/chores-context";
import { ChoreCard } from "../components/chore-card";
import { groupChoresByAssignee, sortChores } from "../helpers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function ByPersonView() {
  const { chores, members } = useChores();
  const grouped = groupChoresByAssignee(chores);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
        {members.map((member) => {
          const memberChores = grouped.get(member.id) ?? [];
          const sortedChores = sortChores(memberChores);
          const displayName = member.displayName ?? member.user.name;

          return (
            <div key={member.id} className="w-80 flex-shrink-0">
              {/* Column Header */}
              <div className="flex items-center gap-3 mb-4 px-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.user.image ?? undefined} alt={displayName} />
                  <AvatarFallback style={{ backgroundColor: member.avatarColor ?? undefined }}>
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {sortedChores.length} chore{sortedChores.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Chores */}
              <div className="space-y-3">
                {sortedChores.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No chores assigned
                  </div>
                ) : (
                  sortedChores.map((chore) => (
                    <ChoreCard key={chore.id} chore={chore} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
