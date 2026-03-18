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
  keywords: [
    "WhatsApp shop",
    "South Africa",
    "informal traders",
    "free shop bot",
    "MoolaBiz",
  ],
  openGraph: {
    title: "MoolaBiz — Free WhatsApp Shop Bot",
    description:
      "Your 24/7 WhatsApp Shop Bot — Free Forever. Built for South African traders.",
    type: "website",
  },
  other: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
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
