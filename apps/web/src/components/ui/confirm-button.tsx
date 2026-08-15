'use client';

import { useTranslations } from 'next-intl';

import { ConfirmButton as UiConfirmButton } from '@kynite/ui';

/**
 * `@kynite/ui`'s `ConfirmButton` with the one string it does not get from its
 * caller filled in.
 *
 * `question`, `confirmLabel` and `triggerLabel` were always props — they say
 * what is being deleted, so only the call site can write them. `cancelLabel`
 * is the opposite: "Annuleren" in every one of the four places this is used,
 * which is why it was read from `useTranslations` inside the component and why
 * it is injected here now that the component itself has to be translation-free.
 */
export function ConfirmButton({
  cancelLabel,
  ...props
}: React.ComponentProps<typeof UiConfirmButton>) {
  const t = useTranslations('common');
  return <UiConfirmButton cancelLabel={cancelLabel ?? t('cancel')} {...props} />;
}
