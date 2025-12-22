import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { routing, type Locale } from "@/i18n/routing";
import { SetLocale } from "./set-locale";
import { QueryProvider } from "@/components/providers/query-provider";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return {
    title: messages.Metadata.title,
    description: messages.Metadata.description,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale as Locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SetLocale locale={locale} />
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
