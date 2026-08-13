/**
 * The Kynite shared component library.
 *
 * `src/components/ui/*` holds the shadcn/Base-UI **primitives** (button, input,
 * card, badge, avatar, dialog…). This folder holds the **composites** the
 * design system defines on top of them — the shapes that appear on more than
 * one screen, so that changing one of them is one edit rather than ten.
 *
 * Rule for page work: if you are about to hand-roll an avatar, a chip, a star
 * count, a progress bar, a section heading or an empty state, it is already
 * here. If a variant is missing, add it here rather than a one-off class string
 * in a page.
 *
 * See `docs/design/README.md` § "Component library" for the component → doc
 * mapping.
 */
export { CategoryChip, CategoryDot } from './category-chip';
export { EmptyState, emptyStateVariants, type EmptyStateProps } from './empty-state';
export { IconMedallion, medallionVariants, type IconMedallionProps } from './icon-medallion';
export { MediaRow } from './media-row';
export { MemberFace, initialsFor } from './member-face';
export { PageHeader } from './page-header';
export { ProgressBar } from './progress-bar';
export { SectionHeading } from './section-heading';
export { StarCount, StarMedallion } from './star-count';
