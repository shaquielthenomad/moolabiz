import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Inter_Tight } from "next/font/google";
import "./globals.css";

// Display: Bricolage Grotesque — characterful but legible, gives the brand a
// crafted personality at headline sizes. Text: Inter Tight — ultra-legible on
// cheap Android screens at small sizes and slightly condensed so long isiZulu/
// isiXhosa words fit on mobile without awkward wrapping.
const fontDisplay = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const fontText = Inter_Tight({
  variable: "--font-text",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MoolaBiz — Your WhatsApp Store. Always Open.",
    template: "%s | MoolaBiz",
  },
  description:
    "Turn your WhatsApp into a 24/7 online store. Take orders, accept payments, and grow your business — no tech skills needed. Built for South African sellers.",
  metadataBase: new URL("https://moolabiz.shop"),
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "MoolaBiz — Your WhatsApp Store. Always Open.",
    description:
      "Sell anything on WhatsApp — cakes, clothing, sneakers, beauty products. Your own online store, live in minutes. No tech skills needed.",
    type: "website",
    url: "https://moolabiz.shop",
    locale: "en_ZA",
    siteName: "MoolaBiz",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "MoolaBiz — Your WhatsApp Store",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MoolaBiz — Your WhatsApp Store. Always Open.",
    description:
      "Turn your WhatsApp into a 24/7 online store. Built for South African sellers.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${fontDisplay.variable} ${fontText.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
