import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Centerpeace — Open-source seating chart for nonprofit fundraising events",
    template: "%s · Centerpeace",
  },
  description:
    "Plan seating for fundraising dinners. Drag guests to tables, manage constraints, collaborate, and export print-ready charts. Bring your own AI — or none at all.",
  keywords: [
    "seating chart",
    "nonprofit",
    "fundraising",
    "gala",
    "event planning",
    "open source",
  ],
  authors: [{ name: "Marcus Toussaint" }],
  creator: "Marcus Toussaint",
  metadataBase: new URL("https://centerpeace.app"),
  openGraph: {
    type: "website",
    title: "Centerpeace",
    description:
      "Open-source seating chart tool for nonprofit fundraising events.",
    siteName: "Centerpeace",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#10131c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSerif.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
