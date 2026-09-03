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
 * Two layers live behind the one entry point. **Primitives** are the
 * shadcn/Base-UI surface — button, input, card, badge, avatar, dialog. Wave B
 * added the **components** layer above them: the composites the design system
 * defines *on top of* the primitives (a section heading, a media row, a routine
 * card, a reward tile) — the shapes that appear on more than one screen, so
 * changing one of them is one edit rather than ten. Rule for page work: if you
 * are about to hand-roll an avatar, a chip, a star count, a progress bar, a
 * section heading or an empty state, it is already here.
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
export {
  DateCircle,
  type DateCircleProps,
  type DateCircleSize,
  type DateCircleState,
} from './components/date-circle';
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
export {
  EventRow,
  type EventRowFaces,
  type EventRowProps,
  type EventRowSize,
  type EventRowState,
} from './components/event-row';
export {
  Fab,
  FabSlot,
  FabSpeedDial,
  type FabProps,
  type FabSpeedDialAction,
  type FabSpeedDialProps,
} from './components/fab';
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
export { Switch } from './components/switch';
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

/* -------------------------------------------------------------------------- */
/* Components — the composites over the primitives (wave B)                    */
/* -------------------------------------------------------------------------- */

export { CategoryChip, CategoryDot } from './components/category-chip';
export {
  CELEBRATION_COLORS,
  CELEBRATION_INTENSITIES,
  CELEBRATION_LIMITS,
  CELEBRATION_PRESETS,
  CONFETTI_BURST_PIECES,
  CONFETTI_BURST_PIECES_BIG,
  prefersReducedMotion,
  type CelebrationIntensity,
  type CelebrationPreset,
  type ConfettiPieceSpec,
} from './components/celebration-presets';
export { ConfettiBurst, type ConfettiBurstProps } from './components/confetti-burst';
export { EmptyState, emptyStateVariants, type EmptyStateProps } from './components/empty-state';
export { FaceStack, type StackedFace } from './components/face-stack';
export { GripHandle } from './components/grip-handle';
export {
  FloatingPiece,
  type FloatingMotion,
  type FloatingPieceProps,
} from './components/floating-piece';
export {
  IconMedallion,
  medallionVariants,
  type IconMedallionProps,
} from './components/icon-medallion';
export { KidStatCard, type KidStatCardProps } from './components/kid-stat-card';
export { MediaRow } from './components/media-row';
export { MemberChip } from './components/member-chip';
export { MemberFace, initialsFor } from './components/member-face';
export { Overline } from './components/overline';
export { PageHeader } from './components/page-header';
export { PillTabs, PillTabsPanel, type PillTabItem } from './components/pill-tabs';
export { ProgressBar } from './components/progress-bar';
export {
  RewardCard,
  type RewardCardCopy,
  type RewardCardProps,
  type RewardTile,
} from './components/reward-card';
export {
  RoutineCard,
  type RoutineCardProps,
  type RoutineCardRoutine,
  type RoutineCardStep,
} from './components/routine-card';
export { SavingsGoalCard, type SavingsGoal } from './components/savings-goal-card';
export { SectionHeading } from './components/section-heading';
export { SegmentedControl, type SegmentedOption } from './components/segmented-control';
export { StarCount, StarMedallion } from './components/star-count';
export { StarPop, type StarPopProps } from './components/star-pop';
export { StarStepper } from './components/star-stepper';
export { StepRow, type StepRowProps } from './components/step-row';
export {
  ThemeBanner,
  type ThemeBannerProps,
  type ThemeBannerTile,
} from './components/theme-banner';
export { WeatherCard, type WeatherCardProps, type WeatherScene } from './components/weather-card';
export { WeekBars, type WeekBar } from './components/week-bars';
