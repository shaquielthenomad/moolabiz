import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MoolaBiz — Free WhatsApp Shop Bot for South African Traders",
  description:
    "Get your own AI-powered WhatsApp shop bot for free. No tech skills needed. Built for South African traders. Start selling on WhatsApp in 8 minutes.",
  openGraph: {
    title: "MoolaBiz — Free WhatsApp Shop Bot",
    description:
      "Your 24/7 WhatsApp Shop Bot — Free Forever. Built for South African traders.",
    type: "website",
    url: "https://moolabiz.shop",
    locale: "en_ZA",
  },
  twitter: {
    card: "summary_large_image",
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
