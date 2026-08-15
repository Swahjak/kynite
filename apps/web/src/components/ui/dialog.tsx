'use client';

import { useTranslations } from 'next-intl';

import { DialogContent as UiDialogContent, DialogFooter as UiDialogFooter } from '@kynite/ui';

/**
 * The localised half of `@kynite/ui`'s `Dialog`.
 *
 * The primitive moved into the design system (Wave A) and takes its close
 * label as a prop, because a component that calls `useTranslations` cannot
 * render in Storybook. That prop should still not be every call site's
 * problem: `t('close')` is the same string in every dialog in the product, and
 * a call site that forgot it would silently ship "Close" to a Dutch family.
 *
 * So this file is the seam. It re-exports the nine parts that never had a
 * string in them untouched, and wraps the two that did. Call sites keep
 * importing `@/components/ui/dialog` and keep looking exactly as they did.
 */
export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@kynite/ui';

export function DialogContent({
  closeLabel,
  ...props
}: React.ComponentProps<typeof UiDialogContent>) {
  const t = useTranslations('common');
  return <UiDialogContent closeLabel={closeLabel ?? t('close')} {...props} />;
}

export function DialogFooter({
  closeLabel,
  ...props
}: React.ComponentProps<typeof UiDialogFooter>) {
  const t = useTranslations('common');
  return <UiDialogFooter closeLabel={closeLabel ?? t('close')} {...props} />;
}
