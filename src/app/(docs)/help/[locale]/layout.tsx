import "nextra-theme-docs/style.css";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function HelpLayout({ children, params }: Props) {
  const { locale } = await params;
  const pageMap = await getPageMap(`/${locale}`);

  return (
    <>
      <Head>
        <title>Help Center - Kynite</title>
      </Head>
      <Layout
        pageMap={pageMap}
        i18n={[
          { locale: "en", name: "English" },
          { locale: "nl", name: "Nederlands" },
        ]}
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
    </>
  );
}
