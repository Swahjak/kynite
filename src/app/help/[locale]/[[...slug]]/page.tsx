import { importPage } from "nextra/pages";
import { useMDXComponents } from "../../../../../mdx-components";

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

export default async function HelpPage({ params }: Props) {
  const { locale, slug } = await params;
  const result = await importPage(slug, locale);
  const { default: MDXContent, toc, metadata } = result;

  return (
    <MDXContent {...{ toc, metadata }} components={useMDXComponents({})} />
  );
}
