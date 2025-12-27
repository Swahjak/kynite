import { importPage } from "nextra/pages";
import type { FC } from "react";
import { useMDXComponents } from "../../../../../../mdx-components";

const locales = ["en", "nl"] as const;
const pages = [
  undefined, // index
  ["getting-started"],
  ["calendar"],
  ["chores"],
  ["rewards"],
  ["wall-hub"],
] as const;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    pages.map((slug) => ({
      locale,
      slug,
    }))
  );
}

type Props = {
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const result = await importPage(slug, locale);
  return result.metadata;
}

// Get the Wrapper component from MDX components - this renders the sidebar and content layout
// Type assertion needed as wrapper is optional in MDXComponents but always provided by nextra-theme-docs

const Wrapper = useMDXComponents({}).wrapper as FC<any>;

export default async function HelpPage({ params }: Props) {
  const { locale, slug } = await params;
  const result = await importPage(slug, locale);
  const { default: MDXContent, toc, metadata } = result;

  return (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent params={{ locale, slug }} />
    </Wrapper>
  );
}
