import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents } from "../../../../../mdx-components";

export const generateStaticParams = generateStaticParamsFor("slug");

type Props = {
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const { metadata } = await importPage(slug, locale);
  return metadata;
}

export default async function HelpPage({ params }: Props) {
  const { locale, slug } = await params;
  const { default: MDXContent, toc, metadata } = await importPage(slug, locale);

  return (
    <MDXContent {...{ toc, metadata }} components={useMDXComponents({})} />
  );
}
