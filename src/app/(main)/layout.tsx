import { Lexend, Noto_Sans } from "next/font/google";
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

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${lexend.variable} ${notoSans.variable} antialiased`}>
      {children}
    </div>
  );
}
