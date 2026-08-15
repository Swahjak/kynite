import type { ReactNode } from 'react';

/**
 * The specimen furniture the design system's own sheet uses, reproduced so a
 * story reads like the page it came from: a monospace caption chip naming the
 * specimen, and the specimen itself under it.
 *
 * Only the *frame* is reproduced. Everything inside a specimen is a real
 * `@kynite/ui` component — the point of the stories is that the components
 * and the sheet agree, which they cannot do if the story redraws the sheet.
 */

/** `Button/Primary`-style caption chip: mono 11px, brand ink on a brand tint. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-brand/8 px-2 py-[3px] font-mono text-[11px] text-brand-ink">
      {children}
    </span>
  );
}

/** One captioned specimen. */
export function Specimen({
  name,
  children,
  note,
}: {
  name: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Caption>{name}</Caption>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {note ? <p className="max-w-prose text-caption text-ink-muted">{note}</p> : null}
    </div>
  );
}

/** A wall of specimens — the layout every section of the sheet uses. */
export function SpecimenGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-x-10 gap-y-8">{children}</div>;
}

/** A titled block, for the sections that need more than one grid. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="border-b border-line-subtle pb-3.5 font-display text-h2">{title}</h2>
      {children}
    </section>
  );
}

/** The four avataaars fixtures, served from `.storybook/static/avatars`. */
export const MEMBERS = [
  { name: 'Mila', src: '/avatars/child1.svg', hue: 335 },
  { name: 'Daan', src: '/avatars/child2.svg', hue: 245 },
  { name: 'Lotte', src: '/avatars/parent1.svg', hue: 290 },
  { name: 'Tom', src: '/avatars/parent2.svg', hue: 65 },
] as const;
