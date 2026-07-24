import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SneakPeekBanner } from "@/components/SneakPeekBanner";
import "./globals.css";

// Sneak-peek banner reads request-time date, so the whole tree needs to
// render per request until 1 Aug 2026 09:00 UK. force-dynamic here does
// that once for the shell, so individual pages don't each have to.
export const dynamic = "force-dynamic";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ignite 27",
  description:
    "Ignite 27. Thursday 21 January 2027. The Renaissance at Kelham Hall, Newark.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-ignite-white font-sans text-ignite-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ignite-black focus:px-4 focus:py-2 focus:text-small focus:text-ignite-white"
        >
          Skip to content
        </a>
        <SneakPeekBanner />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
