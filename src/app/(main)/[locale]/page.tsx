import { setRequestLocale } from "next-intl/server";
import { type Locale } from "@/i18n/routing";
import { HomeContent } from "./home-content";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return <HomeContent />;
}
