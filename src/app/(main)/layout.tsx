import { Lexend, Noto_Sans } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kynite",
  description: "Routines without the friction",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Kynite",
    description: "Routines without the friction",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
};

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${lexend.variable} ${notoSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
