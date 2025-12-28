import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type {
  ControllerRenderProps,
  FieldValues,
  Path,
  UseFormReturn,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";

interface DatePickerProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>;
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>;
  hideTime?: boolean;
  label?: string;
}

export function DateTimePicker<TFieldValues extends FieldValues = FieldValues>({
  form,
  field,
  hideTime = false,
  label,
}: DatePickerProps<TFieldValues>) {
  const { use24HourFormat } = useCalendar();

  // Determine the label to display
  const displayLabel =
    label ?? (field.name === "startDate" ? "Start Date" : "End Date");

  // Determine the date format based on hideTime and time format preference
  const getDateFormat = () => {
    if (hideTime) {
      return "MM/dd/yyyy";
    }
    return use24HourFormat ? "MM/dd/yyyy HH:mm" : "MM/dd/yyyy hh:mm aa";
  };

  function handleDateSelect(date: Date | undefined) {
    if (date) {
      // When setting date, preserve the time from the current value if not hiding time
      const currentValue = field.value as Date | undefined;
      if (!hideTime && currentValue) {
        date.setHours(currentValue.getHours());
        date.setMinutes(currentValue.getMinutes());
      }
      form.setValue(field.name, date as TFieldValues[Path<TFieldValues>]);
    }
  }

  function handleTimeChange(type: "hour" | "minute" | "ampm", value: string) {
    const currentDate = (form.getValues(field.name) as Date) || new Date();
    const newDate = new Date(currentDate);

    if (type === "hour") {
      newDate.setHours(parseInt(value, 10));
    } else if (type === "minute") {
      newDate.setMinutes(parseInt(value, 10));
    } else if (type === "ampm") {
      const hours = newDate.getHours();
      if (value === "AM" && hours >= 12) {
        newDate.setHours(hours - 12);
      } else if (value === "PM" && hours < 12) {
        newDate.setHours(hours + 12);
      }
    }

    form.setValue(field.name, newDate as TFieldValues[Path<TFieldValues>]);
  }

  const dateValue = field.value as Date | undefined;

  return (
    <FormItem className="flex flex-col">
      <FormLabel>{displayLabel}</FormLabel>
      <Popover modal={true}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant={"outline"}
              className={cn(
                "w-full pl-3 text-left font-normal",
                !dateValue && "text-muted-foreground"
              )}
            >
              {dateValue ? (
                format(dateValue, getDateFormat())
              ) : (
                <span>{hideTime ? "MM/DD/YYYY" : "MM/DD/YYYY hh:mm aa"}</span>
              )}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <div className="sm:flex">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleDateSelect}
              initialFocus
            />
            {!hideTime && (
              <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
                <ScrollArea className="w-64 sm:w-auto">
                  <div className="flex p-2 sm:flex-col">
                    {Array.from(
                      { length: use24HourFormat ? 24 : 12 },
                      (_, i) => i
                    ).map((hour) => (
                      <Button
                        key={hour}
                        size="icon"
                        variant={
                          dateValue &&
                          dateValue.getHours() % (use24HourFormat ? 24 : 12) ===
                            hour % (use24HourFormat ? 24 : 12)
                            ? "default"
                            : "ghost"
                        }
                        className="aspect-square shrink-0 sm:w-full"
                        onClick={() =>
                          handleTimeChange("hour", hour.toString())
                        }
                      >
                        {hour.toString().padStart(2, "0")}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" className="sm:hidden" />
                </ScrollArea>
                <ScrollArea className="w-64 sm:w-auto">
                  <div className="flex p-2 sm:flex-col">
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(
                      (minute) => (
                        <Button
                          key={minute}
                          size="icon"
                          variant={
                            dateValue && dateValue.getMinutes() === minute
                              ? "default"
                              : "ghost"
                          }
                          className="aspect-square shrink-0 sm:w-full"
                          onClick={() =>
                            handleTimeChange("minute", minute.toString())
                          }
                        >
                          {minute.toString().padStart(2, "0")}
                        </Button>
                      )
                    )}
                  </div>
                  <ScrollBar orientation="horizontal" className="sm:hidden" />
                </ScrollArea>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}
