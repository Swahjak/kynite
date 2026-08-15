'use client';

import { useTranslations } from 'next-intl';

import { Toaster as UiToaster } from '@kynite/ui';

/**
 * The localised half of `@kynite/ui`'s toast layer.
 *
 * Only one string is the toast system's own — the dismiss button's accessible
 * name — and it is set once, here, where `<Toaster>` is mounted. Everything a
 * toast *says* comes from `toast.add({ title })` at the call site, which is
 * app code and already translated, so `toast` and the parts re-export as they
 * are.
 */
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
  createToastManager,
  toast,
  useToastManager,
} from '@kynite/ui';

export function Toaster({ closeLabel, ...props }: React.ComponentProps<typeof UiToaster>) {
  const t = useTranslations('common');
  return <UiToaster closeLabel={closeLabel ?? t('closeToast')} {...props} />;
}
