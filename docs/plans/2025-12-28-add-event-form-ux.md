# Add Event Form UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the calendar "add event" dialog with person selection (owner + participants), localized date/time formatting via region settings, semantic event types with special behaviors, and predefined categories replacing arbitrary colors.

**Architecture:** Extend existing database schema with `category`, `isCompleted`, and user `region` columns. Create reusable form field components (PersonSelect, MultiSelectCombobox, CategorySelect, EventTypeSelect). Update the main dialog to use new fields with proper i18n support. Leverage existing `eventParticipants.isOwner` for owner/participant distinction.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL, shadcn/ui, react-hook-form, Zod, next-intl, date-fns

---

## Task 1: Add Type Definitions

**Files:**

- Modify: `src/components/calendar/types.ts`

**Step 1: Write the type definitions**

```typescript
// Add to existing types.ts after TCalendarView

export type TEventCategory =
  | "sports"
  | "work"
  | "school"
  | "family"
  | "social"
  | "home";

export type TEventType =
  | "event"
  | "birthday"
  | "appointment"
  | "task"
  | "reminder";

export type TRegion = "US" | "GB" | "NL" | "DE" | "FR" | "ES" | "IT" | "BE";

export const CATEGORY_COLORS: Record<TEventCategory, TEventColor> = {
  sports: "green",
  work: "blue",
  school: "yellow",
  family: "purple",
  social: "pink",
  home: "orange",
};

export const CATEGORY_ICONS: Record<TEventCategory, string> = {
  sports: "activity",
  work: "briefcase",
  school: "graduation-cap",
  family: "users",
  social: "message-circle",
  home: "home",
};

export const EVENT_TYPE_ICONS: Record<TEventType, string> = {
  event: "calendar",
  birthday: "cake",
  appointment: "clock",
  task: "check-square",
  reminder: "bell",
};

export interface RegionConfig {
  dateFormat: string;
  timeFormat12h: boolean;
  dateFnsLocale: string;
}

export const REGION_CONFIGS: Record<TRegion, RegionConfig> = {
  US: { dateFormat: "MM/dd/yyyy", timeFormat12h: true, dateFnsLocale: "en-US" },
  GB: {
    dateFormat: "dd/MM/yyyy",
    timeFormat12h: false,
    dateFnsLocale: "en-GB",
  },
  NL: { dateFormat: "dd-MM-yyyy", timeFormat12h: false, dateFnsLocale: "nl" },
  DE: { dateFormat: "dd.MM.yyyy", timeFormat12h: false, dateFnsLocale: "de" },
  FR: { dateFormat: "dd/MM/yyyy", timeFormat12h: false, dateFnsLocale: "fr" },
  ES: { dateFormat: "dd/MM/yyyy", timeFormat12h: false, dateFnsLocale: "es" },
  IT: { dateFormat: "dd/MM/yyyy", timeFormat12h: false, dateFnsLocale: "it" },
  BE: {
    dateFormat: "dd/MM/yyyy",
    timeFormat12h: false,
    dateFnsLocale: "nl-BE",
  },
};

export const REGIONS: TRegion[] = [
  "US",
  "GB",
  "NL",
  "DE",
  "FR",
  "ES",
  "IT",
  "BE",
];
export const CATEGORIES: TEventCategory[] = [
  "sports",
  "work",
  "school",
  "family",
  "social",
  "home",
];
export const EVENT_TYPES: TEventType[] = [
  "event",
  "birthday",
  "appointment",
  "task",
  "reminder",
];
```

**Step 2: Run typecheck to verify no errors**

Run: `pnpm typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add src/components/calendar/types.ts
git commit -m "feat(calendar): add event category, type, and region type definitions"
```

---

## Task 2: Update IEvent Interface

**Files:**

- Modify: `src/components/calendar/interfaces.ts`

**Step 1: Update the IEvent interface**

```typescript
import type { TEventCategory, TEventType } from "@/components/calendar/types";

export interface IUser {
  id: string;
  name: string;
  avatarFallback: string;
  avatarColor: string | null;
  avatarUrl?: string;
  avatarSvg?: string | null;
}

export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  description: string;
  users: IUser[];
  isHidden?: boolean;
  // New/updated fields
  category: TEventCategory;
  eventType: TEventType;
  allDay: boolean;
  isCompleted?: boolean;
  ownerId?: string;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: FAIL (existing code uses old interface) - this is expected, we'll fix in subsequent tasks

**Step 3: Commit**

```bash
git add src/components/calendar/interfaces.ts
git commit -m "feat(calendar): update IEvent interface with category, eventType, allDay fields"
```

---

## Task 3: Add Database Schema Columns

**Files:**

- Modify: `src/server/schema/calendars.ts`
- Modify: `src/server/schema/auth.ts`

**Step 1: Add columns to events table in calendars.ts**

Add after line 63 (`eventType` definition):

```typescript
  category: text("category"), // 'sports' | 'work' | 'school' | 'family' | 'social' | 'home'
  isCompleted: boolean("is_completed").notNull().default(false),
```

**Step 2: Add region column to users table in auth.ts**

Find the `users` table definition and add:

```typescript
  region: text("region"), // 'US' | 'GB' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'BE'
```

**Step 3: Generate migration**

Run: `pnpm db:generate`
Expected: Migration files created in `drizzle/` directory

**Step 4: Run migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 5: Commit**

```bash
git add src/server/schema/calendars.ts src/server/schema/auth.ts drizzle/
git commit -m "feat(db): add category, isCompleted to events and region to users"
```

---

## Task 4: Update API Validation Schemas

**Files:**

- Modify: `src/lib/validations/event.ts`

**Step 1: Update the validation schema**

```typescript
import { z } from "zod";

export const eventCategorySchema = z.enum([
  "sports",
  "work",
  "school",
  "family",
  "social",
  "home",
]);

export const eventTypeSchema = z.enum([
  "event",
  "birthday",
  "appointment",
  "task",
  "reminder",
]);

// Keep for backward compatibility during migration
export const eventColorSchema = z.enum([
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
]);

export const createEventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(500).nullable().optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    allDay: z.boolean().default(false),
    category: eventCategorySchema.default("family"),
    eventType: eventTypeSchema.default("event"),
    isCompleted: z.boolean().default(false),
    color: eventColorSchema.nullable().optional(), // Deprecated, keep for migration
    googleCalendarId: z.string().nullable().optional(),
    participantIds: z
      .array(z.string())
      .min(1, "At least one participant required"),
    ownerId: z.string().optional(), // First participant is owner if not specified
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateEventSchema = createEventSchema
  .partial()
  .extend({
    id: z.string(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  );

export const eventQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  participantIds: z.array(z.string()).optional(),
  categories: z.array(eventCategorySchema).optional(),
  eventTypes: z.array(eventTypeSchema).optional(),
  colors: z.array(eventColorSchema).optional(), // Deprecated
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/validations/event.ts
git commit -m "feat(api): add category and eventType to event validation schemas"
```

---

## Task 5: Add i18n Translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` inside the existing structure:

```json
"EventDialog": {
  "addTitle": "Add New Event",
  "editTitle": "Edit Event",
  "addDescription": "Create a new event for your calendar.",
  "editDescription": "Modify your existing event.",
  "titleLabel": "Title",
  "titlePlaceholder": "Enter a title",
  "descriptionLabel": "Description",
  "descriptionPlaceholder": "Enter a description (optional)",
  "startDateLabel": "Start Date",
  "endDateLabel": "End Date",
  "assignedToLabel": "Assigned to",
  "assignedToPlaceholder": "Select owner",
  "participantsLabel": "Participants",
  "participantsPlaceholder": "Add participants (optional)",
  "eventTypeLabel": "Event Type",
  "eventTypePlaceholder": "Select type",
  "categoryLabel": "Category",
  "categoryPlaceholder": "Select category",
  "allDayLabel": "All day",
  "createEvent": "Create Event",
  "saveChanges": "Save Changes",
  "successCreate": "Event created successfully",
  "successUpdate": "Event updated successfully",
  "errorCreate": "Failed to add event",
  "errorUpdate": "Failed to edit event",
  "endBeforeStartError": "End date must be after start date"
},
"EventTypes": {
  "event": "Event",
  "birthday": "Birthday",
  "appointment": "Appointment",
  "task": "Task",
  "reminder": "Reminder"
},
"Categories": {
  "sports": "Sports",
  "work": "Work",
  "school": "School",
  "family": "Family",
  "social": "Social",
  "home": "Home"
},
"Regions": {
  "label": "Region",
  "US": "United States",
  "GB": "United Kingdom",
  "NL": "Netherlands",
  "DE": "Germany",
  "FR": "France",
  "ES": "Spain",
  "IT": "Italy",
  "BE": "Belgium"
}
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json`:

```json
"EventDialog": {
  "addTitle": "Nieuw Evenement",
  "editTitle": "Evenement Bewerken",
  "addDescription": "Maak een nieuw evenement voor je agenda.",
  "editDescription": "Pas je bestaande evenement aan.",
  "titleLabel": "Titel",
  "titlePlaceholder": "Voer een titel in",
  "descriptionLabel": "Beschrijving",
  "descriptionPlaceholder": "Voer een beschrijving in (optioneel)",
  "startDateLabel": "Startdatum",
  "endDateLabel": "Einddatum",
  "assignedToLabel": "Toegewezen aan",
  "assignedToPlaceholder": "Selecteer eigenaar",
  "participantsLabel": "Deelnemers",
  "participantsPlaceholder": "Voeg deelnemers toe (optioneel)",
  "eventTypeLabel": "Type evenement",
  "eventTypePlaceholder": "Selecteer type",
  "categoryLabel": "Categorie",
  "categoryPlaceholder": "Selecteer categorie",
  "allDayLabel": "Hele dag",
  "createEvent": "Evenement Aanmaken",
  "saveChanges": "Wijzigingen Opslaan",
  "successCreate": "Evenement succesvol aangemaakt",
  "successUpdate": "Evenement succesvol bijgewerkt",
  "errorCreate": "Evenement aanmaken mislukt",
  "errorUpdate": "Evenement bijwerken mislukt",
  "endBeforeStartError": "Einddatum moet na startdatum zijn"
},
"EventTypes": {
  "event": "Evenement",
  "birthday": "Verjaardag",
  "appointment": "Afspraak",
  "task": "Taak",
  "reminder": "Herinnering"
},
"Categories": {
  "sports": "Sport",
  "work": "Werk",
  "school": "School",
  "family": "Familie",
  "social": "Sociaal",
  "home": "Thuis"
},
"Regions": {
  "label": "Regio",
  "US": "Verenigde Staten",
  "GB": "Verenigd Koninkrijk",
  "NL": "Nederland",
  "DE": "Duitsland",
  "FR": "Frankrijk",
  "ES": "Spanje",
  "IT": "Italie",
  "BE": "Belgie"
}
```

**Step 3: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add translations for event form fields, types, and categories"
```

---

## Task 6: Create PersonSelect Component

**Files:**

- Create: `src/components/calendar/fields/person-select.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/calendar/fields/person-select.tsx
git commit -m "feat(calendar): add PersonSelect component for owner selection"
```

---

## Task 7: Create MultiSelectCombobox Component

**Files:**

- Create: `src/components/ui/multi-select-combobox.tsx`

**Step 1: Create the component**

```typescript
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  emptyText = "No items found.",
  className,
  disabled = false,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };

  const selectedOptions = options.filter((opt) => selected.includes(opt.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start font-normal",
            selected.length === 0 && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {selected.length === 0 ? (
            placeholder
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(option.value);
                  }}
                >
                  {option.icon}
                  {option.label}
                  <X className="ml-1 h-3 w-3 cursor-pointer" />
                </Badge>
              ))}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      selected.includes(option.value)
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50"
                    )}
                  >
                    {selected.includes(option.value) && (
                      <span className="h-4 w-4 text-xs">✓</span>
                    )}
                  </div>
                  {option.icon}
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/ui/multi-select-combobox.tsx
git commit -m "feat(ui): add MultiSelectCombobox component"
```

---

## Task 8: Create CategorySelect Component

**Files:**

- Create: `src/components/calendar/fields/category-select.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/calendar/fields/category-select.tsx
git commit -m "feat(calendar): add CategorySelect component with color swatches"
```

---

## Task 9: Create EventTypeSelect Component

**Files:**

- Create: `src/components/calendar/fields/event-type-select.tsx`

**Step 1: Create the component**

```typescript
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Cake,
  Clock,
  CheckSquare,
  Bell,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type TEventType, EVENT_TYPES } from "@/components/calendar/types";

interface EventTypeSelectProps {
  value: TEventType;
  onValueChange: (value: TEventType) => void;
  disabled?: boolean;
}

const typeIcons: Record<TEventType, React.ReactNode> = {
  event: <Calendar className="h-4 w-4" />,
  birthday: <Cake className="h-4 w-4" />,
  appointment: <Clock className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  reminder: <Bell className="h-4 w-4" />,
};

export function EventTypeSelect({
  value,
  onValueChange,
  disabled = false,
}: EventTypeSelectProps) {
  const t = useTranslations("EventTypes");

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TEventType)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            {typeIcons[value]}
            <span>{t(value)}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {EVENT_TYPES.map((eventType) => (
          <SelectItem key={eventType} value={eventType}>
            <div className="flex items-center gap-2">
              {typeIcons[eventType]}
              <span>{t(eventType)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/calendar/fields/event-type-select.tsx
git commit -m "feat(calendar): add EventTypeSelect component with icons"
```

---

## Task 10: Update Form Schema

**Files:**

- Modify: `src/components/calendar/schemas.ts`

**Step 1: Update the schema**

```typescript
import { z } from "zod";

export const eventCategorySchema = z.enum([
  "sports",
  "work",
  "school",
  "family",
  "social",
  "home",
]);

export const eventTypeSchema = z.enum([
  "event",
  "birthday",
  "appointment",
  "task",
  "reminder",
]);

export const eventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().default(""),
    startDate: z.date({ message: "Start date is required" }),
    endDate: z.date({ message: "End date is required" }),
    category: eventCategorySchema.default("family"),
    eventType: eventTypeSchema.default("event"),
    allDay: z.boolean().default(false),
    ownerId: z.string().min(1, "Owner is required"),
    participantIds: z.array(z.string()).default([]),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type TEventFormData = z.infer<typeof eventSchema>;
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: May have errors in add-edit-event-dialog.tsx (expected, will fix next)

**Step 3: Commit**

```bash
git add src/components/calendar/schemas.ts
git commit -m "feat(calendar): update event form schema with category, eventType, allDay"
```

---

## Task 11: Update Calendar Context

**Files:**

- Modify: `src/components/calendar/contexts/calendar-context.tsx`

**Step 1: Add currentUserId and region to context**

Add to the context interface and provider:

```typescript
// In CalendarContextType interface, add:
currentUserId: string | null;
region: TRegion;

// In CalendarProvider props, add:
currentUserId?: string | null;
region?: TRegion;

// In provider implementation, add:
const [region, setRegion] = useState<TRegion>(initialRegion ?? "NL");

// In context value, add:
currentUserId: currentUserId ?? null,
region,
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS or manageable errors

**Step 3: Commit**

```bash
git add src/components/calendar/contexts/calendar-context.tsx
git commit -m "feat(calendar): add currentUserId and region to CalendarContext"
```

---

## Task 12: Update Add/Edit Event Dialog

**Files:**

- Modify: `src/components/calendar/dialogs/add-edit-event-dialog.tsx`

**Step 1: Update imports**

```typescript
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PersonSelect } from "@/components/calendar/fields/person-select";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { CategorySelect } from "@/components/calendar/fields/category-select";
import { EventTypeSelect } from "@/components/calendar/fields/event-type-select";
import type { TEventCategory, TEventType } from "@/components/calendar/types";
import { CATEGORY_COLORS } from "@/components/calendar/types";
```

**Step 2: Update form default values**

```typescript
const form = useForm<TEventFormData>({
  resolver: zodResolver(eventSchema),
  defaultValues: {
    title: isEditing ? event.title : "",
    description: isEditing ? event.description : "",
    startDate: isEditing
      ? new Date(event.startDate)
      : (startTime ?? new Date()),
    endDate: isEditing
      ? new Date(event.endDate)
      : addMinutes(startTime ?? new Date(), 30),
    category: isEditing ? event.category : "family",
    eventType: isEditing ? event.eventType : "event",
    allDay: isEditing ? event.allDay : false,
    ownerId: isEditing ? (event.ownerId ?? "") : (currentUserId ?? ""),
    participantIds: isEditing
      ? event.users.filter((u) => u.id !== event.ownerId).map((u) => u.id)
      : [],
  },
});
```

**Step 3: Add allDay watch and form fields**

```typescript
const allDay = form.watch("allDay");

// In the form JSX, add these fields after title:

{/* Event Type */}
<FormField
  control={form.control}
  name="eventType"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t("eventTypeLabel")}</FormLabel>
      <FormControl>
        <EventTypeSelect
          value={field.value}
          onValueChange={field.onChange}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

{/* Category */}
<FormField
  control={form.control}
  name="category"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t("categoryLabel")}</FormLabel>
      <FormControl>
        <CategorySelect
          value={field.value}
          onValueChange={field.onChange}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

{/* All Day Toggle */}
<FormField
  control={form.control}
  name="allDay"
  render={({ field }) => (
    <FormItem className="flex items-center justify-between rounded-lg border p-3">
      <div className="space-y-0.5">
        <FormLabel>{t("allDayLabel")}</FormLabel>
      </div>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
    </FormItem>
  )}
/>

{/* Owner (Assigned To) */}
<FormField
  control={form.control}
  name="ownerId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t("assignedToLabel")}</FormLabel>
      <FormControl>
        <PersonSelect
          users={users}
          value={field.value}
          onValueChange={field.onChange}
          placeholder={t("assignedToPlaceholder")}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

{/* Participants */}
<FormField
  control={form.control}
  name="participantIds"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t("participantsLabel")}</FormLabel>
      <FormControl>
        <MultiSelectCombobox
          options={users
            .filter((u) => u.id !== form.watch("ownerId"))
            .map((u) => ({
              value: u.id,
              label: u.name,
            }))}
          selected={field.value}
          onChange={field.onChange}
          placeholder={t("participantsPlaceholder")}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Step 4: Update DateTimePicker calls to respect allDay**

```typescript
{/* Wrap date pickers to hide time when allDay is true */}
<DatePicker
  form={form}
  field={field}
  label={t("startDateLabel")}
  hideTime={allDay}
/>
```

**Step 5: Update onSubmit to use new fields**

```typescript
const onSubmit = (values: TEventFormData) => {
  const ownerUser = users.find((u) => u.id === values.ownerId);
  const participantUsers = users.filter((u) =>
    values.participantIds.includes(u.id)
  );

  const formattedEvent: IEvent = {
    id: isEditing ? event.id : crypto.randomUUID(),
    title: values.title,
    description: values.description ?? "",
    startDate: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
    endDate: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
    category: values.category,
    eventType: values.eventType,
    allDay: values.allDay,
    ownerId: values.ownerId,
    users: ownerUser ? [ownerUser, ...participantUsers] : participantUsers,
  };

  if (isEditing) {
    updateEvent(formattedEvent);
    toast.success(t("successUpdate"));
  } else {
    addEvent(formattedEvent);
    toast.success(t("successCreate"));
  }

  onClose();
  form.reset();
};
```

**Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (may need minor fixes)

**Step 7: Commit**

```bash
git add src/components/calendar/dialogs/add-edit-event-dialog.tsx
git commit -m "feat(calendar): update event dialog with new fields and person selection"
```

---

## Task 13: Update DateTimePicker for allDay Support

**Files:**

- Modify: `src/components/ui/date-time-picker.tsx`

**Step 1: Add hideTime prop**

```typescript
interface DatePickerProps {
  form: UseFormReturn<TEventFormData>;
  field: ControllerRenderProps<TEventFormData, "endDate" | "startDate">;
  label?: string;
  hideTime?: boolean;
}

export function DatePicker({
  form,
  field,
  label,
  hideTime = false,
}: DatePickerProps) {
  // ... existing code

  return (
    <Popover>
      {/* ... trigger code */}
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={field.value}
          onSelect={(date) => date && handleDateChange(date)}
          initialFocus
        />
        {!hideTime && (
          <div className="border-t p-3">
            {/* Time picker content */}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Use translated label**

```typescript
// Update button text to use label prop
<Button variant="outline">
  {label ?? "Select date"}:{" "}
  {field.value ? format(field.value, dateFormat) : "Pick a date"}
</Button>
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/ui/date-time-picker.tsx
git commit -m "feat(ui): add hideTime prop to DateTimePicker for all-day events"
```

---

## Task 14: Update Data Transformers

**Files:**

- Modify: `src/components/calendar/requests.ts`

**Step 1: Update transformEventToIEvent function**

```typescript
export function transformEventToIEvent(event: EventWithParticipants): IEvent {
  const owner = event.participants.find((p) => p.isOwner);

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    startDate: event.startTime.toISOString(),
    endDate: event.endTime.toISOString(),
    category: (event.category as TEventCategory) ?? "family",
    eventType: (event.eventType as TEventType) ?? "event",
    allDay: event.allDay,
    isCompleted: event.isCompleted ?? false,
    ownerId: owner?.familyMember.id,
    users: event.participants.map((p) => ({
      id: p.familyMember.id,
      name: p.familyMember.name,
      avatarFallback: getInitials(p.familyMember.name),
      avatarColor: p.familyMember.avatarColor,
      avatarUrl: p.familyMember.avatarUrl ?? undefined,
      avatarSvg: p.familyMember.avatarSvg,
    })),
  };
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/calendar/requests.ts
git commit -m "feat(calendar): update event transformer for new fields"
```

---

## Task 15: Run Full Test Suite and Fix Issues

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 2: Run linter**

Run: `pnpm lint`
Expected: PASS (fix any issues)

**Step 3: Run unit tests**

Run: `pnpm test:run`
Expected: PASS

**Step 4: Run E2E tests**

Run: `pnpm e2e`
Expected: PASS

**Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test failures and type errors"
```

---

## Task 16: Manual Testing Checklist

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test add event form**

- [ ] Open calendar page
- [ ] Click to add new event
- [ ] Verify all new fields appear: Event Type, Category, All Day, Assigned To, Participants
- [ ] Verify current user is pre-selected as owner
- [ ] Toggle "All day" and verify time pickers hide
- [ ] Select different category and verify color swatch updates
- [ ] Select different event type and verify icon updates
- [ ] Add participants via multi-select
- [ ] Submit form and verify event created with correct data

**Step 3: Test edit event form**

- [ ] Click existing event to edit
- [ ] Verify all fields populated correctly
- [ ] Make changes and save
- [ ] Verify changes persisted

**Step 4: Test i18n**

- [ ] Switch to Dutch locale
- [ ] Verify all labels translated
- [ ] Verify category and event type names translated

---

## Summary

This plan implements:

1. **Type definitions** for categories, event types, and regions
2. **Database schema** updates with migrations
3. **API validation** updates
4. **i18n translations** for en/nl
5. **New UI components**: PersonSelect, MultiSelectCombobox, CategorySelect, EventTypeSelect
6. **Updated form schema** with new fields
7. **Updated calendar context** with currentUserId and region
8. **Updated event dialog** with all new fields
9. **Updated DateTimePicker** with allDay support
10. **Updated data transformers** for new fields

Total: 16 tasks with frequent commits following TDD principles.
