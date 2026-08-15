/**
 * `@kynite/ui` — the Kynite design system's presentational surface.
 *
 * One entry point, deliberately: consumers write `import { Button, Icon } from
 * '@kynite/ui'` and never reach for a file path inside the package. That keeps
 * the internal layout free to move (a primitive can gain a directory, a
 * sub-component or a sibling) without touching a single call site, and it is
 * what makes the boundary rule in `eslint.config.mjs` enforceable — there is
 * exactly one specifier to police.
 *
 * What belongs here: client/presentational primitives with no knowledge of the
 * product. No `next-intl` (labels arrive as props), no `@/modules`, no
 * `@/server`, no `next/*`. A component that needs a link renders one through
 * the Base UI `render` prop, so the *app* supplies `next/link` and the package
 * stays framework-agnostic.
 */

export { cn, FONT_SIZE_TOKENS } from './lib/utils';

export {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from './components/alert-dialog';
export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from './components/avatar';
export { Badge, badgeVariants } from './components/badge';
export { Button, buttonVariants } from './components/button';
export { Calendar, type CalendarProps } from './components/calendar';
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card';
export { Checkbox } from './components/checkbox';
export { ConfirmButton } from './components/confirm-button';
export { DateField, type DateFieldLabels, type DateFieldProps } from './components/date-field';
export { DateTimeField, type DateTimeFieldProps } from './components/date-time-field';
export {
  QUARTER_HOUR_VALUES,
  TIME_STEP_MINUTES,
  type DateOrder,
  type DatePattern,
  dateToIso,
  datePatternFor,
  formatDateValue,
  formatTimeValue,
  isoToDate,
  joinDateTimeValue,
  parseDateInput,
  parseTimeInput,
  splitDateTimeValue,
  timePlaceholderFor,
  uses12Hour,
} from './components/date-time-parts';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';
export { Fab, FabSlot, type FabProps } from './components/fab';
export {
  Field,
  FieldDescription,
  FieldError,
  FieldGroupLabel,
  FieldLabel,
} from './components/field';
export { FieldPicker, type FieldPickerProps } from './components/field-picker';
export { FORMATTING_LOCALES, type FormattingLocale } from './components/formatting-locale';
export { Icon, ICON_SIZES, type IconProps, type IconSize } from './components/icon';
export { ICON_CODEPOINTS, type IconName } from './components/icon-codepoints';
export { Input, inputVariants } from './components/input';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/select';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/sheet';
export { FAB_SLOT_ID, SlotPortal } from './components/slot-portal';
export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants } from './components/tabs';
export { Textarea, textareaVariants } from './components/textarea';
export { TimeField, type TimeFieldLabels, type TimeFieldProps } from './components/time-field';
export {
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Toaster,
  createToastManager,
  toast,
  useToastManager,
} from './components/toast';
export { useSubmitGuard } from './components/use-submit-guard';
