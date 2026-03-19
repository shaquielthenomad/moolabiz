import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const businessName = process.env.BUSINESS_NAME || "Shop";
const slug = process.env.BUSINESS_SLUG || "";

export const metadata: Metadata = {
  title: `${businessName} | MoolaBiz`,
  description: `Browse and order from ${businessName}. Fast, easy, powered by MoolaBiz.`,
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: `${businessName} — Shop Online`,
    description: `Browse products and place your order from ${businessName}.`,
    type: "website",
    url: slug ? `https://${slug}.bot.moolabiz.shop` : undefined,
    siteName: businessName,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="whatsapp" content={process.env.WHATSAPP_NUMBER || ""} />
      </head>
      <body className={`${geistSans.variable} antialiased bg-white text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
