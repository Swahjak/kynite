'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, cn, Tabs, TabsContent, TabsList, TabsTrigger } from '@kynite/ui';

/**
 * The parent's three views of the same economy (`Beloningen.dc.html`, mobile
 * beheer): what is waiting on them, what is on the shelf, and where everybody
 * stands.
 *
 * **The queue comes first, and it is the default.** It is the one part of this
 * app where somebody is waiting on a human being — a child who asked on Sunday
 * is still asking on Tuesday — so it is what the screen opens on, with its
 * count on the tab. Nothing else here is time-sensitive: a catalogue can wait.
 *
 * The panels arrive as `children` so the page can render every one of them on
 * the server and hand them through; only the *switch* is a client concern.
 */
export function RewardsTabs({
  pendingCount,
  queue,
  catalogue,
  balances,
}: {
  pendingCount: number;
  queue: ReactNode;
  catalogue: ReactNode;
  balances: ReactNode;
}) {
  const t = useTranslations('rewards');
  const [value, setValue] = useState('queue');

  /**
   * The sheet's ink for the active tab: **indigo, three pixels**
   * (`Beloningen.dc.html` r206). The primitive's default is a two-pixel
   * foreground rule, which on cream reads as an underline in a document rather
   * than as the brand saying which of three views you are in. Overridden here
   * rather than in `@kynite/ui` because every other `line` tab set in the
   * product still wants the neutral one.
   */
  const inkClass =
    'group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-[3px] group-data-horizontal/tabs:after:rounded-full data-active:after:bg-primary data-active:text-ink';

  return (
    <Tabs value={value} onValueChange={(next) => setValue(next as string)} className="gap-4">
      <TabsList
        variant="line"
        aria-label={t('tabs.label')}
        className="w-full justify-start gap-4.5 border-b border-line-subtle"
      >
        <TabsTrigger
          value="queue"
          data-testid="rewards-tab-queue"
          className={cn('gap-1.5', inkClass)}
        >
          {t('tabs.queue')}
          {pendingCount > 0 ? (
            <Badge variant="default" className="tnum px-1.5">
              {pendingCount}
            </Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="catalogue" data-testid="rewards-tab-catalogue" className={inkClass}>
          {t('tabs.catalogue')}
        </TabsTrigger>
        <TabsTrigger value="balances" data-testid="rewards-tab-balances" className={inkClass}>
          {t('tabs.balances')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="queue">{queue}</TabsContent>
      <TabsContent value="catalogue">{catalogue}</TabsContent>
      <TabsContent value="balances">{balances}</TabsContent>
    </Tabs>
  );
}
