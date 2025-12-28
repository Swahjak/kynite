import { setRequestLocale } from "next-intl/server";
import { type Locale } from "@/i18n/routing";
import { getHomepage } from "@/lib/payload";
import { BlockRenderer, type BlockData } from "@/components/cms";
import { HomepageHeader, HomepageFooter } from "@/components/homepage";
import { HomeContent } from "./home-content";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const page = await getHomepage(locale as "nl" | "en");

  // If CMS content is available, render it with BlockRenderer
  if (page?.layout && page.layout.length > 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <HomepageHeader />
        <main className="flex-1">
          <BlockRenderer blocks={page.layout as BlockData[]} />
        </main>
        <HomepageFooter />
      </div>
    );
  }

  // Fallback to static content if no CMS content is configured
  return <HomeContent />;
}
