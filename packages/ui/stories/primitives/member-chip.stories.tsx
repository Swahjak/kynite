import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MemberChip } from '../../src/components/member-chip';
import { DAAN, FAMILY, MILA } from '../family';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `MemberChip` — a family member as a chip: their face, their name, and
 * whether this one is the one being looked at.
 *
 * The same object does three jobs across the design sheets, and they are the
 * same shape on purpose — a face in a pill always means "this person":
 *
 * - the store's header chips (navigation between one child's shelf and
 *   another's — never a scoreboard);
 * - **"Voor wie"** in the routine builder (`Routines.dc.html`), a
 *   *multi-select*;
 * - **"Aan wie"** in the give-stars sheet (`Beloningen.dc.html`), a
 *   *single* choice.
 *
 * Selected is a ring plus a wash, never a colour swap of the face — the face
 * is the person and it looks the same whoever is chosen.
 */
const meta = {
  title: 'Primitives/Member chip',
  component: MemberChip,
  parameters: { layout: 'padded' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  args: {
    name: MILA.name,
    avatarUrl: MILA.avatar,
    surfaceClass: MILA.surface,
    selected: true,
    size: 'md',
  },
} satisfies Meta<typeof MemberChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SelectedState: Story = {
  name: 'Selected vs. unselected',
  render: () => (
    <Section title="Member chip — selected is a ring plus a wash">
      <Specimen name="MemberChip/selected · unselected">
        <MemberChip name={MILA.name} avatarUrl={MILA.avatar} surfaceClass={MILA.surface} selected />
        <MemberChip name={DAAN.name} avatarUrl={DAAN.avatar} surfaceClass={DAAN.surface} />
      </Specimen>
    </Section>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Section title="Member chip — sm · md · lg">
      <Specimen name="MemberChip/sizes">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <MemberChip
            key={size}
            name={MILA.name}
            avatarUrl={MILA.avatar}
            surfaceClass={MILA.surface}
            size={size}
          />
        ))}
      </Specimen>
    </Section>
  ),
};

export const NoAvatar: Story = {
  name: 'Initials fallback',
  render: () => (
    <Section title="Member chip — no avatar, initials on the member's surface">
      <Specimen name="MemberChip/initials">
        <MemberChip name={MILA.name} initials="M" surfaceClass={MILA.surface} />
      </Specimen>
    </Section>
  ),
};

function VoorWieDemo() {
  const [picked, setPicked] = useState<string[]>([MILA.id]);
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((memberId) => memberId !== id) : [...current, id]
    );

  return (
    <Specimen
      name='MemberChip/"Voor wie" — multi-select'
      note="Routine builder: tap a chip to toggle it — any number may be picked."
    >
      {FAMILY.filter((member) => member.role === 'child').map((member) => (
        <MemberChip
          key={member.id}
          name={member.name}
          avatarUrl={member.avatar}
          surfaceClass={member.surface}
          selected={picked.includes(member.id)}
          render={<button type="button" onClick={() => toggle(member.id)} />}
        />
      ))}
    </Specimen>
  );
}

function AanWieDemo() {
  const [picked, setPicked] = useState(MILA.id);

  return (
    <Specimen
      name='MemberChip/"Aan wie" — single choice'
      note="Give-stars sheet: exactly one child is ever selected."
    >
      {FAMILY.filter((member) => member.role === 'child').map((member) => (
        <MemberChip
          key={member.id}
          name={member.name}
          avatarUrl={member.avatar}
          surfaceClass={member.surface}
          selected={picked === member.id}
          render={<button type="button" onClick={() => setPicked(member.id)} />}
        />
      ))}
    </Specimen>
  );
}

export const SelectionModes: Story = {
  name: 'Voor wie · Aan wie',
  render: () => (
    <Section title="Member chip — the two selection modes it serves">
      <SpecimenGrid>
        <VoorWieDemo />
        <AanWieDemo />
      </SpecimenGrid>
    </Section>
  ),
};
