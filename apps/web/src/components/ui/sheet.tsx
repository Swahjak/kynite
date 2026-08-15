'use client';

import { useTranslations } from 'next-intl';

import { SheetContent as UiSheetContent } from '@kynite/ui';

/**
 * The localised half of `@kynite/ui`'s `Sheet` — see `dialog.tsx` for the
 * reasoning; `SheetContent` is the only part that renders a string of its own.
 */
export {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@kynite/ui';

export function SheetContent({
  closeLabel,
  ...props
}: React.ComponentProps<typeof UiSheetContent>) {
  const t = useTranslations('common');
  return <UiSheetContent closeLabel={closeLabel ?? t('close')} {...props} />;
}
