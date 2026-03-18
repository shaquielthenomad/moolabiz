import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MoolaBiz — Your WhatsApp Store",
  description:
    "Turn your WhatsApp into a 24/7 online store. Take orders, accept payments, and grow your business — no tech skills needed. Built for South African sellers.",
  openGraph: {
    title: "MoolaBiz — Your WhatsApp Store",
    description:
      "Sell anything on WhatsApp. Cakes, clothing, sneakers, beauty products — MoolaBiz turns your WhatsApp number into a fully working online store. No tech skills needed.",
    type: "website",
    url: "https://moolabiz.shop",
    locale: "en_ZA",
  },
  twitter: {
    card: "summary_large_image",
    title: "MoolaBiz — Your WhatsApp Store",
    description:
      "Turn your WhatsApp into a 24/7 online store. Built for South African sellers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
