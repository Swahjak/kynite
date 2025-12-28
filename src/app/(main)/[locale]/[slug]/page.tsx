import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { type Locale } from "@/i18n/routing";
import { getPageBySlug } from "@/lib/payload";
import { HomepageHeader, HomepageFooter } from "@/components/homepage";
import { RichText, type LexicalEditorState } from "@/components/cms/RichText";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const page = await getPageBySlug(slug, locale as "nl" | "en");

  if (!page) {
    notFound();
  }

  // Cast content to LexicalEditorState (Payload stores Lexical JSON in content field)
  const content = page.content as LexicalEditorState | undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <HomepageHeader />
      <main className="container mx-auto flex-1 px-4 py-16">
        <h1 className="mb-8 text-4xl font-bold">{page.title}</h1>
        {content && <RichText content={content} />}
      </main>
      <HomepageFooter />
    </div>
  );
}
