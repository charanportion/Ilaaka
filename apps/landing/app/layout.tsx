import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import {
  ThemeProvider,
  setInitialThemeScript,
} from "@/components/ThemeProvider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ilaaka.app"),
  title: "Ilaaka — Apna Ilaaka. Apni Fitness.",
  description:
    "The fitness app where every step claims territory. Walk, run, or cycle your neighborhood — your route locks in colored zones on the map.",
  keywords: [
    "fitness app India",
    "territory game",
    "running app Hyderabad",
    "walk tracker",
    "social fitness",
    "Ilaaka",
  ],
  applicationName: "Ilaaka",
  openGraph: {
    title: "Ilaaka — Claim your neighborhood",
    description: "The fitness app where every step claims territory.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_IN",
    siteName: "Ilaaka",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ilaaka — Claim your neighborhood",
    description: "Walk, run, or cycle. Your route claims territory.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://ilaaka.app",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08070a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${manrope.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets `theme-light` on <html> before paint to avoid FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: setInitialThemeScript }} />
      </head>
      <body className="bg-grain">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
