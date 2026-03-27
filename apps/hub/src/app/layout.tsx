import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
        url: "/og-image.png",
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
    images: ["/og-image.png"],
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
        <body className={`${geistSans.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
