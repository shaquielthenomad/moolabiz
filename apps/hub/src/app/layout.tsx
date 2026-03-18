import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MoolaBiz — Your Shop Never Sleeps. Even When You Do.",
  description:
    "Get your own AI-powered WhatsApp shop bot. No tech skills needed. Built for South African spaza shops, braiders, and food sellers. Live in 8 minutes.",
  openGraph: {
    title: "MoolaBiz — Your Shop Never Sleeps",
    description:
      "Your shop takes orders, answers customers, and makes sales — 24/7 on WhatsApp. Built in Mzansi for SA traders.",
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
