'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@kynite/ui';

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

  return (
    <Tabs value={value} onValueChange={(next) => setValue(next as string)} className="gap-4">
      <TabsList variant="line" aria-label={t('tabs.label')} className="justify-start gap-4.5">
        <TabsTrigger value="queue" data-testid="rewards-tab-queue" className="gap-1.5">
          {t('tabs.queue')}
          {pendingCount > 0 ? (
            <Badge variant="default" className="tnum px-1.5">
              {pendingCount}
            </Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="catalogue" data-testid="rewards-tab-catalogue">
          {t('tabs.catalogue')}
        </TabsTrigger>
        <TabsTrigger value="balances" data-testid="rewards-tab-balances">
          {t('tabs.balances')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="queue">{queue}</TabsContent>
      <TabsContent value="catalogue">{catalogue}</TabsContent>
      <TabsContent value="balances">{balances}</TabsContent>
    </Tabs>
  );
}
