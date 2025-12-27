import "nextra-theme-docs/style.css";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";

export const metadata = {
  title: "Help Center - Kynite",
};

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

// Transform Nextra's pageMap routes from /{locale}/help/* to /help/{locale}/*
type PageMapItem = {
  name: string;
  route: string;
  title?: string;
  children?: PageMapItem[];
  [key: string]: unknown;
};

function transformRoutes(items: PageMapItem[], locale: string): PageMapItem[] {
  return items.map((item) => {
    const newItem = { ...item };

    // Transform route from /{locale}/help/* to /help/{locale}/*
    if (newItem.route) {
      newItem.route = newItem.route.replace(
        new RegExp(`^/${locale}/help`),
        `/help/${locale}`
      );
    }

    // Recursively transform children
    if (newItem.children) {
      newItem.children = transformRoutes(newItem.children, locale);
    }

    return newItem;
  });
}

export default async function HelpLayout({ children, params }: Props) {
  const { locale } = await params;
  const rawPageMap = await getPageMap(`/${locale}`);

  // Transform routes to match our URL structure
  let pageMap = transformRoutes(rawPageMap as PageMapItem[], locale);

  // Flatten: if pageMap has a single "help" item with children, use the children directly
  if (
    pageMap.length === 1 &&
    pageMap[0].name === "help" &&
    pageMap[0].children
  ) {
    pageMap = pageMap[0].children;
  }

  return (
    <Layout
      pageMap={pageMap}
      // Note: i18n prop disabled because Nextra hardcodes locale extraction from
      // pathname.split("/", 2)[1], which doesn't work with our /help/{locale} structure.
      // It expects /{locale}/help structure. Language switching handled by main app nav.
      navbar={
        <Navbar
          logo={<span className="font-bold">Kynite Help</span>}
          projectLink="/"
        />
      }
      footer={<Footer>© {new Date().getFullYear()} Kynite</Footer>}
    >
      {children}
    </Layout>
  );
}
