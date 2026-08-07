'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/icon';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { OVERFLOW_NAV, isActiveHref, type NavLabels } from './nav-items';

/**
 * The "More" sheet, shared by the desktop rail and the mobile bottom bar.
 *
 * Both surfaces open the *same* list, which is the point: a destination that is
 * one tap away on a phone must not be unreachable on a laptop. The trigger is
 * supplied by the caller because the two chrome shapes style it completely
 * differently — a 56px rail tile vs. a bottom-bar tab — while the sheet itself,
 * its ordering and its active state are identical.
 */
export function NavOverflowSheet({
  labels,
  renderTrigger,
}: {
  labels: NavLabels;
  renderTrigger: (props: { onClick: () => void; active: boolean }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const active = OVERFLOW_NAV.some((item) => isActiveHref(pathname, item.href));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {renderTrigger({ onClick: () => setOpen(true), active })}
      <SheetContent side="bottom" data-testid="mobile-nav-sheet">
        <SheetHeader>
          <SheetTitle>{labels.more}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 p-4 pt-0">
          {OVERFLOW_NAV.map(({ href, label, icon }) => (
            <SheetClose
              key={href}
              render={
                <Link
                  href={href}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 font-display text-body-sm font-semibold transition-colors duration-200 ease-brand hover:bg-muted"
                />
              }
            >
              <Icon name={icon} size="sm" />
              {labels[label]}
            </SheetClose>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
