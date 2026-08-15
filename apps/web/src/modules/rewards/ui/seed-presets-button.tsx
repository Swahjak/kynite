'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@kynite/ui';
import { idleState } from '../action-state';
import { seedRewardPresetsAction } from '../actions';
import type { RewardCategory } from '../schema';

/**
 * One tap to fill an empty shelf (research §Decisions 8, §"Single-admin trap").
 *
 * The presets are posted as parallel form fields carrying *translated* titles,
 * because a preset is a starting point a parent then edits — storing a
 * translation key would make an edited reward and a pristine one two different
 * kinds of row. Cost and category still go through the same server-side schema
 * a hand-typed reward does, so nothing here is trusted.
 */
export function SeedPresetsButton({
  presets,
}: {
  presets: { title: string; icon: string; costStars: number; category: RewardCategory }[];
}) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(seedRewardPresetsAction, idleState);

  return (
    <form action={formAction}>
      {presets.map((preset) => (
        <span key={preset.title}>
          <input type="hidden" name="presetTitle" value={preset.title} />
          <input type="hidden" name="presetIcon" value={preset.icon} />
          <input type="hidden" name="presetCost" value={preset.costStars} />
          <input type="hidden" name="presetCategory" value={preset.category} />
        </span>
      ))}
      <Button type="submit" size="hub" disabled={pending} data-testid="seed-presets">
        <Icon name="add" size="md" inline="start" />
        {t('actions.seedPresets')}
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}
