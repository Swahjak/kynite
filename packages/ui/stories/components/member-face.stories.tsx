import type { Meta, StoryObj } from '@storybook/react-vite';

import { FaceStack } from '../../src/components/face-stack';
import { MemberFace } from '../../src/components/member-face';
import { MEMBERS, Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `MemberFace` — a person's face: their avatar if they picked one, their
 * initials on their own colour otherwise (`Avatars` § the eight-hue ring).
 *
 * This is the presentational half of the pattern. It takes already-resolved
 * strings — `initials`, `surfaceClass`, `ringClass` — rather than a
 * `MemberColor`, which is what lets it render from any surface, including ones
 * that cannot reach the family slice. The app's `MemberAvatar` is the
 * domain-aware wrapper that resolves a member row onto it; every avatar in the
 * product goes through one of the two.
 *
 * `ringed` is the identity marker the mockups use: a 2px ring in the member's
 * own colour, `ring-offset-2` against the card. It is opt-in rather than the
 * default because the shell's header avatar and the hub's person columns
 * already carry their own ring treatment, and two rings is none.
 *
 * `FaceStack` is the overlapping group: faces, not names, because on a card
 * sized for a glance from the other side of a kitchen the face is the fastest
 * answer to "whose is this". It is one `role="img"` with one label, so a screen
 * reader gets "Mila, Daan" once rather than every name twice.
 */
const RINGS = [
  'ring-cat-pink-solid',
  'ring-cat-blue-solid',
  'ring-cat-purple-solid',
  'ring-cat-yellow-solid',
] as const;

const SURFACES = [
  'bg-cat-pink-surface text-cat-pink-fg',
  'bg-cat-blue-surface text-cat-blue-fg',
  'bg-cat-purple-surface text-cat-purple-fg',
  'bg-cat-yellow-surface text-cat-yellow-fg',
] as const;

const meta = {
  title: 'Components/Member face',
  component: MemberFace,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'default', 'lg', 'hub'] },
    ringed: { control: 'boolean' },
  },
  args: {
    name: 'Mila',
    avatarUrl: MEMBERS[0].src,
    surfaceClass: SURFACES[0],
    ringClass: RINGS[0],
    size: 'lg',
    ringed: true,
  },
} satisfies Meta<typeof MemberFace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Faces: Story = {
  render: () => (
    <Section title="Member face">
      <SpecimenGrid>
        <Specimen name="MemberFace/avatar" note="The picked avatar, ringed in the member's hue.">
          {MEMBERS.map((member, index) => (
            <MemberFace
              key={member.name}
              name={member.name}
              avatarUrl={member.src}
              ringed
              ringClass={RINGS[index]}
              surfaceClass={SURFACES[index]}
            />
          ))}
        </Specimen>

        <Specimen name="MemberFace/initials" note="No avatar — initials on the member's surface.">
          {MEMBERS.map((member, index) => (
            <MemberFace key={member.name} name={member.name} surfaceClass={SURFACES[index]} />
          ))}
        </Specimen>

        <Specimen name="MemberFace/sizes" note="xs · sm · default · lg · hub (the wall display).">
          {(['xs', 'sm', 'default', 'lg', 'hub'] as const).map((size) => (
            <MemberFace key={size} name="Mila" avatarUrl={MEMBERS[0].src} size={size} />
          ))}
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const Stack: Story = {
  render: () => (
    <Section title="Face stack — whose is this">
      <SpecimenGrid>
        <Specimen name="FaceStack/two" note='"Mila &amp; Daan" — the two-owner case.'>
          <FaceStack
            faces={MEMBERS.slice(0, 2).map((member, index) => ({
              id: member.name,
              name: member.name,
              avatarUrl: member.src,
              surfaceClass: SURFACES[index],
            }))}
          />
        </Specimen>

        <Specimen name="FaceStack/everyone" note="The whole family, at `default`.">
          <FaceStack
            size="default"
            faces={MEMBERS.map((member, index) => ({
              id: member.name,
              name: member.name,
              avatarUrl: member.src,
              surfaceClass: SURFACES[index],
            }))}
          />
        </Specimen>

        <Specimen name="FaceStack/none" note="Nobody's — renders nothing, never a placeholder.">
          <FaceStack faces={[]} />
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
