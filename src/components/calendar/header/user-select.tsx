import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { cn } from "@/lib/utils";
import type { IUser } from "@/components/calendar/interfaces";

function CalendarUserAvatar({
  user,
  className,
}: {
  user: IUser;
  className?: string;
}) {
  // If user has custom SVG avatar, render it
  if (user.avatarSvg) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full",
          className
        )}
        dangerouslySetInnerHTML={{ __html: user.avatarSvg }}
      />
    );
  }

  return (
    <Avatar className={className}>
      <AvatarImage src={user.avatarUrl} alt={user.name} />
      <AvatarFallback className={cn("text-xxs text-white", user.avatarColor)}>
        {user.avatarFallback}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserSelect() {
  const { users, selectedUserId, filterEventsBySelectedUser } = useCalendar();

  return (
    <Select value={selectedUserId!} onValueChange={filterEventsBySelectedUser}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a user" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">
          <AvatarGroup className="mx-2 flex items-center" max={3}>
            {users.map((user) => (
              <CalendarUserAvatar
                key={user.id}
                user={user}
                className="text-xxs size-6"
              />
            ))}
          </AvatarGroup>
          All
        </SelectItem>

        {users.map((user) => (
          <SelectItem
            key={user.id}
            value={user.id}
            className="flex-1 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CalendarUserAvatar user={user} className="size-6" />
              <p className="truncate">{user.name}</p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
