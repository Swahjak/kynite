import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '../../src/components/avatar';
import { Icon } from '../../src/components/icon';
import { MEMBERS, Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Avatars` — the three sheet sizes (32 / 44 / 56), the two in-list ones
 * (24 / 28) and the 16px grid-block one, the stack, the fallback and the
 * status badge.
 *
 * The faces are the four avataaars fixtures from the design project
 * (`docs/design/claude-design/uploads/`), served out of the package's static
 * dir. Each sits on the tinted ring background the sheet gives it —
 * `oklch(94% 0.03 H)` at that member's category hue.
 */
const meta = {
  title: 'Primitives/Avatars',
  component: Avatar,
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'inline-radio', options: ['2xs', 'xs', 'sm', 'default', 'lg', 'hub'] },
    ring: { control: 'boolean' },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

function Face({
  member,
  size,
  ring,
}: {
  member: (typeof MEMBERS)[number];
  size?: '2xs' | 'xs' | 'sm' | 'default' | 'lg' | 'hub';
  ring?: boolean;
}) {
  return (
    <Avatar size={size} ring={ring} style={{ background: `oklch(94% 0.03 ${member.hue})` }}>
      <AvatarImage src={member.src} alt={member.name} />
      <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}

export const Playground: Story = {
  args: { size: 'hub', ring: false },
  render: (args) => <Face member={MEMBERS[0]} size={args.size} ring={args.ring} />,
};

export const Sizes: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Avatars — sizes">
      <SpecimenGrid>
        <Specimen name="Avatar/Sizes" note="2xs 16 · xs 24 · sm 28 · default 32 · lg 44 · hub 56">
          <Face member={MEMBERS[3]} size="2xs" />
          <Face member={MEMBERS[0]} size="xs" />
          <Face member={MEMBERS[1]} size="sm" />
          <Face member={MEMBERS[2]} size="default" />
          <Face member={MEMBERS[3]} size="lg" />
          <Face member={MEMBERS[0]} size="hub" />
        </Specimen>
        <Specimen
          name="Avatar/Ring"
          note="The 56px specimen's halo — 0 0 0 3px rgba(93,95,239,.15)."
        >
          <Face member={MEMBERS[1]} size="hub" ring />
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const Stack: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Avatars — stack">
      <SpecimenGrid>
        <Specimen name="Avatar/Stack" note="Overlapped, each ringed in the background colour.">
          <AvatarGroup>
            {MEMBERS.map((member) => (
              <Face key={member.name} member={member} size="lg" />
            ))}
          </AvatarGroup>
        </Specimen>
        <Specimen name="Avatar/Stack + count">
          <AvatarGroup>
            {MEMBERS.slice(0, 2).map((member) => (
              <Face key={member.name} member={member} />
            ))}
            <AvatarGroupCount>+3</AvatarGroupCount>
          </AvatarGroup>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const FallbackAndBadge: Story = {
  name: 'Fallback & badge',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Avatars — fallback & badge">
      <SpecimenGrid>
        <Specimen name="Avatar/Fallback" note="Initials in Baloo 2 when there is no image.">
          <Avatar size="lg">
            <AvatarFallback>MI</AvatarFallback>
          </Avatar>
          <Avatar size="hub">
            <AvatarFallback>TO</AvatarFallback>
          </Avatar>
        </Specimen>
        <Specimen name="Avatar/Badge" note="Status dot — online, or a completed-routine tick.">
          <Avatar size="hub" style={{ background: `oklch(94% 0.03 ${MEMBERS[2].hue})` }}>
            <AvatarImage src={MEMBERS[2].src} alt={MEMBERS[2].name} />
            <AvatarFallback>LO</AvatarFallback>
            <AvatarBadge>
              <Icon name="check" size="xs" />
            </AvatarBadge>
          </Avatar>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
