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
  metadataBase: new URL("https://ilaaka.dotportion.com"),
  title: {
    default: "Ilaaka — Apna Ilaaka. Apni Fitness.",
    template: "%s · Ilaaka",
  },
  description:
    "The fitness app where every step claims territory. Walk, run, or cycle your neighbourhood — your route locks in coloured zones on the map. Built in Hyderabad.",
  keywords: [
    "Ilaaka",
    "fitness app India",
    "fitness territory game",
    "walking app Hyderabad",
    "running app Hyderabad",
    "cycling app Hyderabad",
    "GPS tracker India",
    "social fitness app",
    "neighbourhood walking",
    "Apna Ilaaka",
  ],
  applicationName: "Ilaaka",
  authors: [{ name: "Sri Charan Rayala", url: "https://ilaaka.dotportion.com" }],
  creator: "Sri Charan Rayala",
  publisher: "dotportion",
  category: "health",
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ilaaka",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Ilaaka — Apna Ilaaka. Apni Fitness.",
    description:
      "The fitness app where every step claims territory. Walk, run, or cycle your neighbourhood — your route locks in coloured zones on the map.",
    locale: "en_IN",
    siteName: "Ilaaka",
    type: "website",
    url: "https://ilaaka.dotportion.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ilaaka — Apna Ilaaka. Apni Fitness.",
    description:
      "Walk, run, or cycle. Your route claims territory. Friends can steal it back.",
  },
  alternates: {
    canonical: "https://ilaaka.dotportion.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f1e3" },
    { media: "(prefers-color-scheme: dark)", color: "#08070a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ilaaka.dotportion.com/#org",
      name: "Ilaaka",
      url: "https://ilaaka.dotportion.com",
      logo: "https://ilaaka.dotportion.com/icon.svg",
      founder: {
        "@type": "Person",
        name: "Sri Charan Rayala",
      },
      foundingLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Hyderabad",
          addressRegion: "Telangana",
          addressCountry: "IN",
        },
      },
      email: "sricharan.rayala@dotportion.com",
    },
    {
      "@type": "MobileApplication",
      "@id": "https://ilaaka.dotportion.com/#app",
      name: "Ilaaka",
      description:
        "A location-based fitness territory app for India. Walk, run, or cycle to claim geographic zones; friends can steal them back.",
      applicationCategory: "HealthApplication",
      applicationSubCategory: "FitnessApplication",
      operatingSystem: "Android",
      url: "https://ilaaka.dotportion.com",
      downloadUrl: "https://ilaaka.dotportion.com/install",
      inLanguage: "en-IN",
      countriesSupported: "IN",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
      },
      publisher: { "@id": "https://ilaaka.dotportion.com/#org" },
    },
    {
      "@type": "WebSite",
      "@id": "https://ilaaka.dotportion.com/#site",
      url: "https://ilaaka.dotportion.com",
      name: "Ilaaka",
      publisher: { "@id": "https://ilaaka.dotportion.com/#org" },
      inLanguage: "en-IN",
    },
  ],
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
        {/* Schema.org structured data — Organization, MobileApplication,
            WebSite. Helps Google understand the entity and improves the
            knowledge-panel + sitelinks treatment for branded queries. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(STRUCTURED_DATA),
          }}
        />
      </head>
      <body className="bg-grain">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
