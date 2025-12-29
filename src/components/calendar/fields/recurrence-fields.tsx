"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Repeat } from "lucide-react";
import { useState } from "react";
import type { TEventFormData } from "@/components/calendar/schemas";

const FREQUENCY_OPTIONS = [
  { value: "none", labelKey: "doesNotRepeat" },
  { value: "daily", labelKey: "daily" },
  { value: "weekly", labelKey: "weekly" },
  { value: "monthly", labelKey: "monthly" },
  { value: "yearly", labelKey: "yearly" },
] as const;

const FREQUENCY_UNIT_LABELS: Record<string, string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
  yearly: "years",
};

const END_TYPE_OPTIONS = [
  { value: "never", labelKey: "never" },
  { value: "count", labelKey: "afterOccurrences" },
  { value: "date", labelKey: "onDate" },
] as const;

export function RecurrenceFields() {
  const form = useFormContext<TEventFormData>();
  const t = useTranslations("RecurrenceFields");
  const [isOpen, setIsOpen] = useState(false);

  const frequency = form.watch("recurrence.frequency");
  const endType = form.watch("recurrence.endType");
  const showRecurrenceOptions = frequency !== "none";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="flex w-full justify-between p-0 hover:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            {t("repeat")}
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4 rounded-lg border p-4">
        {/* Frequency */}
        <FormField
          control={form.control}
          name="recurrence.frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("frequency")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectFrequency")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showRecurrenceOptions && (
          <>
            {/* Interval */}
            <FormField
              control={form.control}
              name="recurrence.interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("every")}</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        className="w-20"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <span className="text-muted-foreground text-sm">
                      {t(
                        (FREQUENCY_UNIT_LABELS[frequency] ?? "days") as
                          | "days"
                          | "weeks"
                          | "months"
                          | "years"
                      )}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Type */}
            <FormField
              control={form.control}
              name="recurrence.endType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ends")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {END_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Count */}
            {endType === "count" && (
              <FormField
                control={form.control}
                name="recurrence.endCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("occurrences")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* End Date */}
            {endType === "date" && (
              <FormField
                control={form.control}
                name="recurrence.endDate"
                render={({ field }) => (
                  <DateTimePicker
                    form={form}
                    field={field}
                    hideTime
                    label={t("endDate")}
                  />
                )}
              />
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
