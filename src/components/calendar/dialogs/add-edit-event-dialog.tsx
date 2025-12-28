import { zodResolver } from "@hookform/resolvers/zod";
import { addMinutes, format, set } from "date-fns";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/responsive-modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  MultiSelectCombobox,
  type MultiSelectOption,
} from "@/components/ui/multi-select-combobox";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { CategorySelect } from "@/components/calendar/fields/category-select";
import { EventTypeSelect } from "@/components/calendar/fields/event-type-select";
import { PersonSelect } from "@/components/calendar/fields/person-select";
import { useDisclosure } from "@/components/calendar/hooks";
import type { IEvent } from "@/components/calendar/interfaces";
import {
  eventSchema,
  type TEventFormData,
} from "@/components/calendar/schemas";
import type { TEventCategory, TEventType } from "@/components/calendar/types";

interface IProps {
  children: ReactNode;
  startDate?: Date;
  startTime?: { hour: number; minute: number };
  event?: IEvent;
}

export function AddEditEventDialog({
  children,
  startDate,
  startTime,
  event,
}: IProps) {
  const { isOpen, onClose, onToggle } = useDisclosure();
  const { addEvent, updateEvent, users, currentUserId } = useCalendar();
  const t = useTranslations("EventDialog");
  const tCommon = useTranslations("Common");
  const isEditing = !!event;

  const initialDates = useMemo(() => {
    if (!isEditing && !event) {
      if (!startDate) {
        const now = new Date();
        return { startDate: now, endDate: addMinutes(now, 30) };
      }
      const start = startTime
        ? set(new Date(startDate), {
            hours: startTime.hour,
            minutes: startTime.minute,
            seconds: 0,
          })
        : new Date(startDate);
      const end = addMinutes(start, 30);
      return { startDate: start, endDate: end };
    }

    return {
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
    };
  }, [startDate, startTime, event, isEditing]);

  // Get default owner (current user or first user available)
  const defaultOwnerId = currentUserId ?? (users.length > 0 ? users[0].id : "");

  const form = useForm<TEventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event?.title ?? "",
      description: event?.description ?? "",
      startDate: initialDates.startDate,
      endDate: initialDates.endDate,
      category: event?.category ?? "family",
      eventType: event?.eventType ?? "event",
      allDay: event?.allDay ?? false,
      ownerId: event?.ownerId ?? defaultOwnerId,
      participantIds:
        event?.users.filter((u) => u.id !== event?.ownerId).map((u) => u.id) ??
        [],
    },
  });

  useEffect(() => {
    form.reset({
      title: event?.title ?? "",
      description: event?.description ?? "",
      startDate: initialDates.startDate,
      endDate: initialDates.endDate,
      category: event?.category ?? "family",
      eventType: event?.eventType ?? "event",
      allDay: event?.allDay ?? false,
      ownerId: event?.ownerId ?? defaultOwnerId,
      participantIds:
        event?.users.filter((u) => u.id !== event?.ownerId).map((u) => u.id) ??
        [],
    });
  }, [event, initialDates, form, defaultOwnerId]);

  const allDay = form.watch("allDay");

  // Build participant options from users (excluding owner)
  const participantOptions: MultiSelectOption[] = useMemo(() => {
    const ownerId = form.getValues("ownerId");
    return users
      .filter((user) => user.id !== ownerId)
      .map((user) => ({
        value: user.id,
        label: user.name,
      }));
  }, [users, form]);

  const onSubmit = (values: TEventFormData) => {
    try {
      // Build users array from ownerId and participantIds
      const owner = users.find((u) => u.id === values.ownerId);
      const participants = users.filter((u) =>
        values.participantIds.includes(u.id)
      );
      const eventUsers = owner ? [owner, ...participants] : participants;

      const formattedEvent: IEvent = {
        id: isEditing
          ? event.id
          : Math.floor(Math.random() * 1000000).toString(),
        title: values.title,
        description: values.description ?? "",
        startDate: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
        category: values.category as TEventCategory,
        eventType: values.eventType as TEventType,
        allDay: values.allDay,
        ownerId: values.ownerId,
        users: eventUsers,
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
    } catch (error) {
      console.error(`Error ${isEditing ? "editing" : "adding"} event:`, error);
      toast.error(isEditing ? t("errorUpdate") : t("errorCreate"));
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={onToggle} modal={false}>
      <ModalTrigger asChild>{children}</ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{isEditing ? t("editTitle") : t("addTitle")}</ModalTitle>
          <ModalDescription>
            {isEditing ? t("editDescription") : t("addDescription")}
          </ModalDescription>
        </ModalHeader>

        <Form {...form}>
          <form
            id="event-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-4"
          >
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel htmlFor="title" className="required">
                    {t("titleLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="title"
                      placeholder={t("titlePlaceholder")}
                      {...field}
                      className={fieldState.invalid ? "border-red-500" : ""}
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
                <FormItem className="flex items-center justify-between">
                  <Label htmlFor="allDay">{t("allDayLabel")}</Label>
                  <FormControl>
                    <Switch
                      id="allDay"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <DateTimePicker
                  form={form}
                  field={field}
                  hideTime={allDay}
                  label={t("startDateLabel")}
                />
              )}
            />

            {/* End Date */}
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DateTimePicker
                  form={form}
                  field={field}
                  hideTime={allDay}
                  label={t("endDateLabel")}
                />
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required">
                    {t("categoryLabel")}
                  </FormLabel>
                  <FormControl>
                    <CategorySelect
                      value={field.value as TEventCategory}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Event Type */}
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required">
                    {t("eventTypeLabel")}
                  </FormLabel>
                  <FormControl>
                    <EventTypeSelect
                      value={field.value as TEventType}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Owner */}
            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required">
                    {t("assignedToLabel")}
                  </FormLabel>
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
                      options={participantOptions}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder={t("participantsPlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("descriptionPlaceholder")}
                      className={fieldState.invalid ? "border-red-500" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <ModalFooter className="flex justify-end gap-2">
          <ModalClose asChild>
            <Button type="button" variant="outline">
              {tCommon("cancel")}
            </Button>
          </ModalClose>
          <Button form="event-form" type="submit">
            {isEditing ? t("saveChanges") : t("createEvent")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
